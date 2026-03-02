import sgMail from '@sendgrid/mail';
import type {
  BaseEmailTemplateRenderer,
  BaseNotificationBackend,
  DatabaseNotification,
} from 'vintasend';
import { type Mock, type Mocked, vi } from 'vitest';
import { SendgridNotificationAdapterFactory } from '../index';
import type { SendgridConfig } from '../sendgrid-notification-adapter';

vi.mock('@sendgrid/mail');

describe('SendgridNotificationAdapter', () => {
  const mockSend = vi.fn();
  const mockSetApiKey = vi.fn();

  const mockTemplateRenderer = {
    render: vi.fn(),
    renderFromTemplateContent: vi.fn(),
  } as Mocked<BaseEmailTemplateRenderer<any>>;

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
