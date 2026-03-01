import sgMail from '@sendgrid/mail';
import type { BaseNotificationBackend } from 'vintasend/dist/services/notification-backends/base-notification-backend';
import type { BaseEmailTemplateRenderer } from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { DatabaseNotification } from 'vintasend/dist/types/notification';
import type { StoredAttachment, AttachmentFile } from 'vintasend/dist/types/attachment';
import { SendgridNotificationAdapterFactory } from '../index';
import type { SendgridConfig } from '../sendgrid-notification-adapter';
import { vi, type Mock, type Mocked } from 'vitest';

vi.mock('@sendgrid/mail');

describe('SendgridNotificationAdapter - Attachments', () => {
  const mockSend = vi.fn();
  const mockSetApiKey = vi.fn();

  const mockTemplateRenderer = {
    render: vi.fn(),
    renderFromTemplateContent: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  } as Mocked<BaseEmailTemplateRenderer<any>>;

  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  const mockBackend: Mocked<BaseNotificationBackend<any>> = {
    persistNotification: vi.fn(),
    persistNotificationUpdate: vi.fn(),
    getAllFutureNotifications: vi.fn(),
    getAllFutureNotificationsFromUser: vi.fn(),
    getFutureNotificationsFromUser: vi.fn(),
    getFutureNotifications: vi.fn(),
    getAllPendingNotifications: vi.fn(),
    getPendingNotifications: vi.fn(),
    getNotification: vi.fn(),
    markAsRead: vi.fn(),
    filterAllInAppUnreadNotifications: vi.fn(),
    cancelNotification: vi.fn(),
    markAsSent: vi.fn(),
    markAsFailed: vi.fn(),
    storeAdapterAndContextUsed: vi.fn(),
    getUserEmailFromNotification: vi.fn(),
    filterInAppUnreadNotifications: vi.fn(),
    bulkPersistNotifications: vi.fn(),
    getAllNotifications: vi.fn(),
    getNotifications: vi.fn(),
    persistOneOffNotification: vi.fn(),
    persistOneOffNotificationUpdate: vi.fn(),
    getOneOffNotification: vi.fn(),
    getAllOneOffNotifications: vi.fn(),
    getOneOffNotifications: vi.fn(),
    getAttachmentFile: vi.fn(),
    deleteAttachmentFile: vi.fn(),
    getOrphanedAttachmentFiles: vi.fn(),
    getAttachments: vi.fn(),
    deleteNotificationAttachment: vi.fn(),
    findAttachmentFileByChecksum: vi.fn(),
    filterNotifications: vi.fn(),
  };

  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  let mockNotification: DatabaseNotification<any>;
  let config: SendgridConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    (sgMail.setApiKey as Mock) = mockSetApiKey;
    (sgMail.send as Mock) = mockSend;

    config = {
      apiKey: 'SG.test-api-key',
      fromEmail: 'noreply@example.com',
      fromName: 'Example App',
    };

    mockNotification = {
      id: '123',
      notificationType: 'EMAIL' as const,
      contextName: 'testContext',
      contextParameters: {},
      userId: '456',
      title: 'Test Notification',
      bodyTemplate: '/path/to/template',
      subjectTemplate: '/path/to/subject',
      extraParams: {},
      contextUsed: null,
      adapterUsed: null,
      status: 'PENDING_SEND' as const,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
      sendAfter: new Date(),
    };
  });

  it('should report that it supports attachments', () => {
    const adapter = new SendgridNotificationAdapterFactory().create(
      mockTemplateRenderer,
      false,
      config,
    );

    expect(adapter.supportsAttachments).toBe(true);
  });

  it('should send email with single attachment', async () => {
    const adapter = new SendgridNotificationAdapterFactory().create(
      mockTemplateRenderer,
      false,
      config,
    );
    adapter.injectBackend(mockBackend);

    const fileBuffer = Buffer.from('test file content');
    const mockFile: AttachmentFile = {
      read: vi.fn().mockResolvedValue(fileBuffer),
      stream: vi.fn(),
      url: vi.fn(),
      delete: vi.fn(),
    };

    const attachment: StoredAttachment = {
      id: 'att-1',
      fileId: 'file-1',
      filename: 'test.pdf',
      contentType: 'application/pdf',
      size: fileBuffer.length,
      checksum: 'abc123',
      description: 'Test file',
      file: mockFile,
      createdAt: new Date(),
      storageMetadata: { id: 'storage-1' },
    };

    mockNotification.attachments = [attachment];

    const context = { foo: 'bar' };
    const renderedTemplate = {
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    };
    const userEmail = 'user@example.com';

    mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
    mockBackend.getUserEmailFromNotification.mockResolvedValue(userEmail);

    await adapter.send(mockNotification, context);

    expect(mockFile.read).toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledWith({
      to: userEmail,
      from: { email: 'noreply@example.com', name: 'Example App' },
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
      attachments: [
        {
          filename: 'test.pdf',
          content: fileBuffer.toString('base64'),
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    });
  });

  it('should send email with multiple attachments', async () => {
    const adapter = new SendgridNotificationAdapterFactory().create(
      mockTemplateRenderer,
      false,
      config,
    );
    adapter.injectBackend(mockBackend);

    const fileBuffer1 = Buffer.from('file 1 content');
    const fileBuffer2 = Buffer.from('file 2 content');

    const mockFile1: AttachmentFile = {
      read: vi.fn().mockResolvedValue(fileBuffer1),
      stream: vi.fn(),
      url: vi.fn(),
      delete: vi.fn(),
    };

    const mockFile2: AttachmentFile = {
      read: vi.fn().mockResolvedValue(fileBuffer2),
      stream: vi.fn(),
      url: vi.fn(),
      delete: vi.fn(),
    };

    const attachment1: StoredAttachment = {
      id: 'att-1',
      fileId: 'file-1',
      filename: 'document.pdf',
      contentType: 'application/pdf',
      size: fileBuffer1.length,
      checksum: 'abc123',
      description: 'PDF document',
      file: mockFile1,
      createdAt: new Date(),
      storageMetadata: { id: 'storage-1' },
    };

    const attachment2: StoredAttachment = {
      id: 'att-2',
      fileId: 'file-2',
      filename: 'image.png',
      contentType: 'image/png',
      size: fileBuffer2.length,
      checksum: 'def456',
      description: 'Image file',
      file: mockFile2,
      createdAt: new Date(),
      storageMetadata: { id: 'storage-2' },
    };

    mockNotification.attachments = [attachment1, attachment2];

    const context = { foo: 'bar' };
    const renderedTemplate = {
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    };
    const userEmail = 'user@example.com';

    mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
    mockBackend.getUserEmailFromNotification.mockResolvedValue(userEmail);

    await adapter.send(mockNotification, context);

    expect(mockFile1.read).toHaveBeenCalled();
    expect(mockFile2.read).toHaveBeenCalled();
    expect(mockSend).toHaveBeenCalledWith({
      to: userEmail,
      from: { email: 'noreply@example.com', name: 'Example App' },
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
      attachments: [
        {
          filename: 'document.pdf',
          content: fileBuffer1.toString('base64'),
          type: 'application/pdf',
          disposition: 'attachment',
        },
        {
          filename: 'image.png',
          content: fileBuffer2.toString('base64'),
          type: 'image/png',
          disposition: 'attachment',
        },
      ],
    });
  });

  it('should send email without attachments when attachments array is empty', async () => {
    const adapter = new SendgridNotificationAdapterFactory().create(
      mockTemplateRenderer,
      false,
      config,
    );
    adapter.injectBackend(mockBackend);

    mockNotification.attachments = [];

    const context = { foo: 'bar' };
    const renderedTemplate = {
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    };
    const userEmail = 'user@example.com';

    mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
    mockBackend.getUserEmailFromNotification.mockResolvedValue(userEmail);

    await adapter.send(mockNotification, context);

    expect(mockSend).toHaveBeenCalledWith({
      to: userEmail,
      from: { email: 'noreply@example.com', name: 'Example App' },
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
    });
  });

  it('should send email without attachments when attachments is undefined', async () => {
    const adapter = new SendgridNotificationAdapterFactory().create(
      mockTemplateRenderer,
      false,
      config,
    );
    adapter.injectBackend(mockBackend);

    mockNotification.attachments = undefined;

    const context = { foo: 'bar' };
    const renderedTemplate = {
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    };
    const userEmail = 'user@example.com';

    mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
    mockBackend.getUserEmailFromNotification.mockResolvedValue(userEmail);

    await adapter.send(mockNotification, context);

    expect(mockSend).toHaveBeenCalledWith({
      to: userEmail,
      from: { email: 'noreply@example.com', name: 'Example App' },
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
    });
  });
});
