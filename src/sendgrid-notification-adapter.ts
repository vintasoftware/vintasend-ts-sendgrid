import type { MailDataRequired } from '@sendgrid/mail';
import sgMail from '@sendgrid/mail';
import type {
  AnyDatabaseNotification,
  BaseEmailTemplateRenderer,
  BaseNotificationTypeConfig,
  EmailTemplate,
  JsonObject,
  StoredAttachment,
} from 'vintasend';
import { BaseNotificationAdapter, log, logCount, logError, logId } from 'vintasend';

export interface SendgridConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
}

export class SendgridNotificationAdapter<
  TemplateRenderer extends BaseEmailTemplateRenderer<Config>,
  Config extends BaseNotificationTypeConfig,
> extends BaseNotificationAdapter<TemplateRenderer, Config> {
  public key: string | null = 'sendgrid';
  private config: SendgridConfig;

  constructor(
    templateRenderer: TemplateRenderer,
    enqueueNotifications: boolean,
    config: SendgridConfig,
  ) {
    super(templateRenderer, 'EMAIL', enqueueNotifications);
    this.config = config;
    sgMail.setApiKey(config.apiKey);
  }

  get supportsAttachments(): boolean {
    return true;
  }

  /**
   * Returns what the renderer produced so the service can record which template version rendered
   * this notification. Nothing else reads it — the message is already sent by then.
   */
  async send(
    notification: AnyDatabaseNotification<Config>,
    context: JsonObject,
  ): Promise<EmailTemplate> {
    if (!this.backend) {
      throw new Error('Backend not injected');
    }

    const template = await this.templateRenderer.render(notification, context);

    if (!notification.id) {
      throw new Error('Notification ID is required');
    }

    // Use the helper method to get recipient email (handles both regular and one-off notifications)
    const recipientEmail = await this.getRecipientEmail(notification);

    const mailData: MailDataRequired = {
      to: recipientEmail,
      from: this.config.fromName
        ? { email: this.config.fromEmail, name: this.config.fromName }
        : this.config.fromEmail,
      subject: template.subject,
      html: template.body,
    };

    // Add attachments if present
    if (notification.attachments && notification.attachments.length > 0) {
      this.logger?.info(
        log`Preparing ${logCount(notification.attachments.length)} attachment(s) for notification ID ${logId(notification.id)}`,
      );
      mailData.attachments = await this.prepareAttachments(notification.attachments);
      this.logger?.info(
        log`Added ${logCount(notification.attachments.length)} attachment(s) to email for notification ID ${logId(notification.id)}`,
      );
    } else {
      this.logger?.info(log`No attachments found for notification ID ${logId(notification.id)}`);
    }

    try {
      await sgMail.send(mailData);
    } catch (error) {
      // SendGrid's ResponseError keeps the HTTP status in `code`; its message and `response.body`
      // can echo the recipient and the email content, so only the name and status are logged.
      const code = (error as { code?: unknown } | null)?.code;
      this.logger?.error(
        log`SendGrid failed to send email for notification ID ${logId(notification.id)}: ${logError(
          error,
          typeof code === 'number' ? { status: code } : {},
        )}`,
      );
      throw error;
    }
    this.logger?.info(log`Email sent for notification ID ${logId(notification.id)}`);

    return template;
  }

  protected async prepareAttachments(
    attachments: StoredAttachment[],
  ): Promise<NonNullable<MailDataRequired['attachments']>> {
    return Promise.all(
      attachments.map(async (att, index) => {
        try {
          this.logger?.info(
            log`Preparing attachment ${logCount(index + 1)}/${logCount(attachments.length)}: ${logId(att.id)}`,
          );
          const content = await att.file.read();
          this.logger?.info(
            log`Attachment ${logId(att.id)} read successfully, size: ${logCount(content.length)} bytes`,
          );
          return {
            filename: att.filename,
            content: content.toString('base64'),
            type: att.contentType,
            disposition: 'attachment',
          };
        } catch (error) {
          this.logger?.error(
            log`Failed to prepare attachment ${logId(att.id)}: ${logError(error)}`,
          );
          throw error;
        }
      }),
    );
  }
}

export class SendgridNotificationAdapterFactory<Config extends BaseNotificationTypeConfig> {
  create<TemplateRenderer extends BaseEmailTemplateRenderer<Config>>(
    templateRenderer: TemplateRenderer,
    enqueueNotifications: boolean,
    config: SendgridConfig,
  ) {
    return new SendgridNotificationAdapter<TemplateRenderer, Config>(
      templateRenderer,
      enqueueNotifications,
      config,
    );
  }
}
