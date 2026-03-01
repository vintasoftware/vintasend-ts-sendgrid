import sgMail from '@sendgrid/mail';
import type { BaseNotificationBackend } from 'vintasend/dist/services/notification-backends/base-notification-backend';
import type { BaseEmailTemplateRenderer } from 'vintasend/dist/services/notification-template-renderers/base-email-template-renderer';
import type {
  DatabaseNotification,
  DatabaseOneOffNotification,
} from 'vintasend/dist/types/notification';
import type { SendgridNotificationAdapter } from '../index';
import { SendgridNotificationAdapterFactory } from '../index';
import type { SendgridConfig } from '../sendgrid-notification-adapter';
import { vi, type Mock, type Mocked } from 'vitest';

vi.mock('@sendgrid/mail');

describe('SendgridNotificationAdapter - One-Off Notifications', () => {
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
  let mockOneOffNotification: DatabaseOneOffNotification<any>;
  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  let mockRegularNotification: DatabaseNotification<any>;
  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  let adapter: SendgridNotificationAdapter<typeof mockTemplateRenderer, any>;
  let config: SendgridConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    (sgMail.setApiKey as Mock) = mockSetApiKey;
    (sgMail.send as Mock) = mockSend;

    // Reset the send mock to resolve successfully by default
    mockSend.mockResolvedValue([
      {
        statusCode: 202,
        body: '',
        headers: {},
      },
      {},
    ]);

    config = {
      apiKey: 'SG.test-api-key',
      fromEmail: 'noreply@example.com',
      fromName: 'Example App',
    };

    mockOneOffNotification = {
      id: '123',
      emailOrPhone: 'oneoff@example.com',
      firstName: 'John',
      lastName: 'Doe',
      notificationType: 'EMAIL' as const,
      contextName: 'testContext',
      contextParameters: {},
      title: 'Test One-Off Notification',
      bodyTemplate: '/path/to/template',
      subjectTemplate: 'Test Subject',
      extraParams: {},
      contextUsed: null,
      adapterUsed: null,
      status: 'PENDING_SEND' as const,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
      sendAfter: null,
    };

    mockRegularNotification = {
      id: '456',
      userId: 'user-789',
      notificationType: 'EMAIL' as const,
      contextName: 'testContext',
      contextParameters: {},
      title: 'Test Regular Notification',
      bodyTemplate: '/path/to/template',
      subjectTemplate: 'Test Subject',
      extraParams: {},
      contextUsed: null,
      adapterUsed: null,
      status: 'PENDING_SEND' as const,
      sentAt: null,
      readAt: null,
      gitCommitSha: null,
      sendAfter: new Date(),
    };

    adapter = new SendgridNotificationAdapterFactory().create(mockTemplateRenderer, false, config);

    adapter.injectBackend(mockBackend);
  });

  describe('sending one-off notifications', () => {
    it('should send one-off notification to emailOrPhone address', async () => {
      mockTemplateRenderer.render.mockResolvedValue({
        subject: 'Test Subject',
        body: '<p>Test Body</p>',
      });

      await adapter.send(mockOneOffNotification, {});

      expect(mockTemplateRenderer.render).toHaveBeenCalledWith(mockOneOffNotification, {});
      expect(mockSend).toHaveBeenCalledWith({
        to: 'oneoff@example.com',
        from: { email: 'noreply@example.com', name: 'Example App' },
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
      });
      expect(mockBackend.getUserEmailFromNotification).not.toHaveBeenCalled();
    });

    it('should send one-off notification with context', async () => {
      mockTemplateRenderer.render.mockResolvedValue({
        subject: 'Welcome {{firstName}}',
        body: '<p>Hello {{firstName}} {{lastName}}</p>',
      });

      const context = {
        firstName: 'John',
        lastName: 'Doe',
        customField: 'value',
      };

      await adapter.send(mockOneOffNotification, context);

      expect(mockTemplateRenderer.render).toHaveBeenCalledWith(mockOneOffNotification, context);
      expect(mockSend).toHaveBeenCalledWith({
        to: 'oneoff@example.com',
        from: { email: 'noreply@example.com', name: 'Example App' },
        subject: 'Welcome {{firstName}}',
        html: '<p>Hello {{firstName}} {{lastName}}</p>',
      });
    });

    it('should handle email sending errors for one-off notifications', async () => {
      mockTemplateRenderer.render.mockResolvedValue({
        subject: 'Test Subject',
        body: '<p>Test Body</p>',
      });

      const error = new Error('SendGrid API error');
      mockSend.mockRejectedValue(error);

      await expect(adapter.send(mockOneOffNotification, {})).rejects.toThrow(
        'SendGrid API error',
      );
    });

    it('should throw error if notification ID is missing for one-off notification', async () => {
      const notificationWithoutId = {
        ...mockOneOffNotification,
        id: null,
        // biome-ignore lint/suspicious/noExplicitAny: any just for testing
      } as any;

      await expect(adapter.send(notificationWithoutId, {})).rejects.toThrow(
        'Notification ID is required',
      );
    });
  });

  describe('sending regular notifications (backward compatibility)', () => {
    it('should still send regular notifications using getUserEmailFromNotification', async () => {
      mockTemplateRenderer.render.mockResolvedValue({
        subject: 'Test Subject',
        body: '<p>Test Body</p>',
      });

      mockBackend.getUserEmailFromNotification.mockResolvedValue('user@example.com');

      await adapter.send(mockRegularNotification, {});

      expect(mockTemplateRenderer.render).toHaveBeenCalledWith(mockRegularNotification, {});
      expect(mockBackend.getUserEmailFromNotification).toHaveBeenCalledWith('456');
      expect(mockSend).toHaveBeenCalledWith({
        to: 'user@example.com',
        from: { email: 'noreply@example.com', name: 'Example App' },
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
      });
    });

    it('should handle missing user email for regular notifications', async () => {
      mockTemplateRenderer.render.mockResolvedValue({
        subject: 'Test Subject',
        body: '<p>Test Body</p>',
      });

      mockBackend.getUserEmailFromNotification.mockResolvedValue(undefined);

      await expect(adapter.send(mockRegularNotification, {})).rejects.toThrow(
        'User email not found for notification 456',
      );
    });
  });

  describe('mixed notification sending', () => {
    it('should correctly handle sending both one-off and regular notifications in sequence', async () => {
      mockTemplateRenderer.render.mockResolvedValue({
        subject: 'Test Subject',
        body: '<p>Test Body</p>',
      });

      mockBackend.getUserEmailFromNotification.mockResolvedValue('user@example.com');

      // Send one-off notification
      await adapter.send(mockOneOffNotification, {});
      expect(mockSend).toHaveBeenCalledWith({
        to: 'oneoff@example.com',
        from: { email: 'noreply@example.com', name: 'Example App' },
        subject: 'Test Subject',
        html: '<p>Test Body</p>',
      });

      vi.clearAllMocks();
      mockTemplateRenderer.render.mockResolvedValue({
        subject: 'Test Subject 2',
        body: '<p>Test Body 2</p>',
      });

      // Send regular notification
      await adapter.send(mockRegularNotification, {});
      expect(mockBackend.getUserEmailFromNotification).toHaveBeenCalledWith('456');
      expect(mockSend).toHaveBeenCalledWith({
        to: 'user@example.com',
        from: { email: 'noreply@example.com', name: 'Example App' },
        subject: 'Test Subject 2',
        html: '<p>Test Body 2</p>',
      });
    });
  });

  describe('error handling', () => {
    it('should throw error if backend not injected for one-off notifications', async () => {
      const adapterWithoutBackend = new SendgridNotificationAdapterFactory().create(
        mockTemplateRenderer,
        false,
        config,
      );

      await expect(adapterWithoutBackend.send(mockOneOffNotification, {})).rejects.toThrow(
        'Backend not injected',
      );
    });

    it('should handle template rendering errors for one-off notifications', async () => {
      const error = new Error('Template not found');
      mockTemplateRenderer.render.mockRejectedValue(error);

      await expect(adapter.send(mockOneOffNotification, {})).rejects.toThrow('Template not found');
      expect(mockSend).not.toHaveBeenCalled();
    });
  });
});
