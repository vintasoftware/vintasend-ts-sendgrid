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

jest.mock('@sendgrid/mail');

describe('SendgridNotificationAdapter - One-Off Notifications', () => {
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
  let mockOneOffNotification: DatabaseOneOffNotification<any>;
  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  let mockRegularNotification: DatabaseNotification<any>;
  // biome-ignore lint/suspicious/noExplicitAny: any just for testing
  let adapter: SendgridNotificationAdapter<typeof mockTemplateRenderer, any>;
  let config: SendgridConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    (sgMail.setApiKey as jest.Mock) = mockSetApiKey;
    (sgMail.send as jest.Mock) = mockSend;

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

      jest.clearAllMocks();
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
