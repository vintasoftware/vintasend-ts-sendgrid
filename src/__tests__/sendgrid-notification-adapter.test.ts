import sgMail from '@sendgrid/mail';
import type { BaseNotificationBackend } from 'vintasend/dist/services/notification-backends/base-notification-backend';
import type { BaseEmailTemplateRenderer } from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type { DatabaseNotification } from 'vintasend/dist/types/notification';
import { SendgridNotificationAdapterFactory } from '../index';
import type { SendgridConfig } from '../sendgrid-notification-adapter';

jest.mock('@sendgrid/mail');

describe('SendgridNotificationAdapter', () => {
  const mockSend = jest.fn();
  const mockSetApiKey = jest.fn();

  const mockTemplateRenderer = {
    render: jest.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  } as jest.Mocked<BaseEmailTemplateRenderer<any>>;

  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  const mockBackend: jest.Mocked<BaseNotificationBackend<any>> = {
    persistNotification: jest.fn(),
    persistNotificationUpdate: jest.fn(),
    getAllFutureNotifications: jest.fn(),
    getAllFutureNotificationsFromUser: jest.fn(),
    getFutureNotificationsFromUser: jest.fn(),
    getFutureNotifications: jest.fn(),
    getAllPendingNotifications: jest.fn(),
    getPendingNotifications: jest.fn(),
    getNotification: jest.fn(),
    markAsRead: jest.fn(),
    filterAllInAppUnreadNotifications: jest.fn(),
    cancelNotification: jest.fn(),
    markAsSent: jest.fn(),
    markAsFailed: jest.fn(),
    storeContextUsed: jest.fn(),
    getUserEmailFromNotification: jest.fn(),
    filterInAppUnreadNotifications: jest.fn(),
    bulkPersistNotifications: jest.fn(),
    getAllNotifications: jest.fn(),
    getNotifications: jest.fn(),
    persistOneOffNotification: jest.fn(),
    persistOneOffNotificationUpdate: jest.fn(),
    getOneOffNotification: jest.fn(),
    getAllOneOffNotifications: jest.fn(),
    getOneOffNotifications: jest.fn(),
    getAttachmentFile: jest.fn(),
    deleteAttachmentFile: jest.fn(),
    getOrphanedAttachmentFiles: jest.fn(),
    getAttachments: jest.fn(),
    deleteNotificationAttachment: jest.fn(),
    findAttachmentFileByChecksum: jest.fn(),
  };

  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  let mockNotification: DatabaseNotification<any>;
  let config: SendgridConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    (sgMail.setApiKey as jest.Mock) = mockSetApiKey;
    (sgMail.send as jest.Mock) = mockSend;

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
      sendAfter: new Date(),
    };
  });

  it('should initialize with correct properties and set API key', () => {
    const adapter = new SendgridNotificationAdapterFactory().create(
      mockTemplateRenderer,
      false,
      config,
    );

    expect(adapter.notificationType).toBe('EMAIL');
    expect(adapter.key).toBe('sendgrid');
    expect(adapter.enqueueNotifications).toBe(false);
    expect(mockSetApiKey).toHaveBeenCalledWith('SG.test-api-key');
  });

  it('should send email successfully with fromName', async () => {
    const adapter = new SendgridNotificationAdapterFactory().create(
      mockTemplateRenderer,
      false,
      config,
    );
    adapter.injectBackend(mockBackend);

    const context = { foo: 'bar' };
    const renderedTemplate = {
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    };
    const userEmail = 'user@example.com';

    mockTemplateRenderer.render.mockResolvedValue(renderedTemplate);
    mockBackend.getUserEmailFromNotification.mockResolvedValue(userEmail);

    await adapter.send(mockNotification, context);

    expect(mockTemplateRenderer.render).toHaveBeenCalledWith(mockNotification, context);
    expect(mockBackend.getUserEmailFromNotification).toHaveBeenCalledWith('123');
    expect(mockSend).toHaveBeenCalledWith({
      to: userEmail,
      from: { email: 'noreply@example.com', name: 'Example App' },
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
    });
  });

  it('should send email successfully without fromName', async () => {
    const configWithoutName = {
      apiKey: 'SG.test-api-key',
      fromEmail: 'noreply@example.com',
    };

    const adapter = new SendgridNotificationAdapterFactory().create(
      mockTemplateRenderer,
      false,
      configWithoutName,
    );
    adapter.injectBackend(mockBackend);

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
      from: 'noreply@example.com',
      subject: renderedTemplate.subject,
      html: renderedTemplate.body,
    });
  });

  it('should throw error if notification ID is missing', async () => {
    const adapter = new SendgridNotificationAdapterFactory().create(
      mockTemplateRenderer,
      false,
      config,
    );
    adapter.injectBackend(mockBackend);

    mockNotification.id = undefined;

    await expect(adapter.send(mockNotification, {})).rejects.toThrow('Notification ID is required');
  });

  it('should throw error if backend not injected', async () => {
    const adapter = new SendgridNotificationAdapterFactory().create(
      mockTemplateRenderer,
      false,
      config,
    );

    mockNotification.id = '123';

    await expect(adapter.send(mockNotification, {})).rejects.toThrow('Backend not injected');
  });

  it('should throw error if user email is not found', async () => {
    const adapter = new SendgridNotificationAdapterFactory().create(
      mockTemplateRenderer,
      false,
      config,
    );
    adapter.injectBackend(mockBackend);

    mockTemplateRenderer.render.mockResolvedValue({
      subject: 'Test Subject',
      body: '<p>Test Body</p>',
    });
    mockBackend.getUserEmailFromNotification.mockResolvedValue(undefined);

    await expect(adapter.send(mockNotification, {})).rejects.toThrow(
      'User email not found for notification 123',
    );
  });
});
