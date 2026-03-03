import type { MailDataRequired } from '@sendgrid/mail';
import sgMail from '@sendgrid/mail';
import type {
  AnyDatabaseNotification,
  BaseEmailTemplateRenderer,
  BaseNotificationTypeConfig,
  JsonObject,
  StoredAttachment,
} from 'vintasend';
import { BaseNotificationAdapter } from 'vintasend';

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

  async send(notification: AnyDatabaseNotification<Config>, context: JsonObject): Promise<void> {
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
        `Preparing ${notification.attachments.length} attachment(s) for notification ID ${notification.id}`,
      );
      mailData.attachments = await this.prepareAttachments(notification.attachments);
      this.logger?.info(
        `Added ${notification.attachments.length} attachment(s) to email for notification ID ${notification.id}`,
      );
    } else {
      this.logger?.info(`No attachments found for notification ID ${notification.id}`);
    }

    await sgMail.send(mailData);
    this.logger?.info(`Email sent for notification ID ${notification.id}`);
  }

  protected async prepareAttachments(
    attachments: StoredAttachment[],
  ): Promise<NonNullable<MailDataRequired['attachments']>> {
    return Promise.all(
      attachments.map(async (att, index) => {
        try {
          this.logger?.info(
            `Preparing attachment ${index + 1}/${attachments.length}: ${att.filename}`,
          );
          this.logger?.info(`Attachment storage metadata: ${JSON.stringify(att.storageMetadata)}`);
          const content = await att.file.read();
          this.logger?.info(
            `Attachment ${att.filename} read successfully, size: ${content.length} bytes`,
          );
          return {
            filename: att.filename,
            content: content.toString('base64'),
            type: att.contentType,
            disposition: 'attachment',
          };
        } catch (error) {
          this.logger?.error(`Failed to prepare attachment ${att.filename}`);
          this.logger?.error(`Error details: ${JSON.stringify(error, null, 2)}`);
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
