import sgMail from '@sendgrid/mail';
import type { MailDataRequired } from '@sendgrid/mail';
import type { AttachmentData } from '@sendgrid/helpers/classes/attachment';

import { BaseNotificationAdapter } from 'vintasend/dist/services/notification-adapters/base-notification-adapter';
import type { BaseEmailTemplateRenderer } from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { JsonObject } from 'vintasend/dist/types/json-values';
import type { AnyDatabaseNotification } from 'vintasend/dist/types/notification';
import type { BaseNotificationTypeConfig } from 'vintasend/dist/types/notification-type-config';
import type { StoredAttachment } from 'vintasend/dist/types/attachment';

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
      mailData.attachments = await this.prepareAttachments(notification.attachments);
    }

    await sgMail.send(mailData);
  }

  protected async prepareAttachments(
    attachments: StoredAttachment[],
  ): Promise<AttachmentData[]> {
    return Promise.all(
      attachments.map(async (att) => {
        const content = await att.file.read();
        return {
          filename: att.filename,
          content: content.toString('base64'),
          type: att.contentType,
          disposition: 'attachment',
        };
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
