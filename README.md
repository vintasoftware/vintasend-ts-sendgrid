# VintaSend SendGrid Adapter

A VintaSend email notification adapter using [SendGrid](https://sendgrid.com/) for reliable email delivery with attachment support.

## Installation

```bash
npm install vintasend-sendgrid @sendgrid/mail
```

## Configuration

```typescript
import { SendgridNotificationAdapterFactory } from 'vintasend-sendgrid';

const adapter = new SendgridNotificationAdapterFactory().create(
  templateRenderer,
  false, // enqueueNotifications
  {
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: 'noreply@example.com',
    fromName: 'My App', // optional
  }
);
```

### Configuration Options

```typescript
interface SendgridConfig {
  apiKey: string;        // SendGrid API key
  fromEmail: string;     // Default sender email address
  fromName?: string;     // Optional sender name
}
```

## Usage

### Basic Email

```typescript
await notificationService.createNotification({
  userId: '123',
  notificationType: 'EMAIL',
  contextName: 'welcome',
  contextParameters: { firstName: 'John' },
  title: 'Welcome!',
  bodyTemplate: '/templates/welcome.pug',
  subjectTemplate: '/templates/subjects/welcome.pug',
  sendAfter: new Date(),
});
```

### Email with Attachments

```typescript
import { readFile } from 'fs/promises';

await notificationService.createNotification({
  userId: '123',
  notificationType: 'EMAIL',
  contextName: 'invoice',
  contextParameters: { invoiceNumber: 'INV-001' },
  title: 'Your invoice',
  bodyTemplate: '/templates/invoice.pug',
  subjectTemplate: '/templates/subjects/invoice.pug',
  sendAfter: new Date(),
  attachments: [
    {
      file: await readFile('./invoice.pdf'),
      filename: 'invoice.pdf',
      contentType: 'application/pdf',
    },
  ],
});
```

### One-Off Notifications

Send emails without a user account:

```typescript
await notificationService.createOneOffNotification({
  emailOrPhone: 'customer@example.com',
  firstName: 'Jane',
  lastName: 'Smith',
  notificationType: 'EMAIL',
  contextName: 'order-confirmation',
  contextParameters: { orderNumber: '12345' },
  title: 'Order Confirmation',
  bodyTemplate: '/templates/order-confirmation.pug',
  subjectTemplate: '/templates/subjects/order-confirmation.pug',
  sendAfter: new Date(),
});
```

## Features

- ✅ Email delivery via SendGrid API
- ✅ File attachments (automatically base64 encoded)
- ✅ One-off notifications
- ✅ Scheduled notifications
- ✅ Custom sender name and email
- ✅ HTML email templates
- ✅ Multiple attachments per email

## API Reference

### SendgridNotificationAdapterFactory

```typescript
class SendgridNotificationAdapterFactory<Config extends BaseNotificationTypeConfig>
```

**Methods:**
- `create<TemplateRenderer>(templateRenderer, enqueueNotifications, config)` - Create adapter instance

### SendgridNotificationAdapter

**Properties:**
- `key: string` - Returns `'sendgrid'`
- `notificationType: NotificationType` - Returns `'EMAIL'`
- `supportsAttachments: boolean` - Returns `true`

**Methods:**
- `send(notification, context)` - Send an email with optional attachments

## Environment Variables

```bash
SENDGRID_API_KEY=SG.your-api-key-here
FROM_EMAIL=noreply@example.com
FROM_NAME=My Application

The `TemplateAttachmentManager` provides a structure for implementing file attachment storage for notifications.

**Supported Storage Backends:**
- AWS S3 (see [`vintasend-aws-s3-attachments`](../vintasend-aws-s3-attachments))
- Azure Blob Storage
- Google Cloud Storage
- Local Filesystem (development only)
- Any S3-compatible storage (MinIO, DigitalOcean Spaces, etc.)

**Implementation Steps:**

1. **Copy this template** to a new package:
   ```bash
   cp -r src/implementations/vintasend-implementation-template src/implementations/vintasend-{your-storage}-attachments
   ```

2. **Update package.json**:
   - Change package name to match your implementation
   - Add storage-specific dependencies (e.g., `@aws-sdk/client-s3` for S3)
   - Update description and keywords

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Rename the class**:
   - Rename `TemplateAttachmentManager` to your implementation name (e.g., `S3AttachmentManager`)
   - Update all references in exports and tests

4. **Implement the required methods**:

   - `uploadFile(file, filename, contentType?)` - Upload file to your storage backend
     - Convert file to Buffer using `this.fileToBuffer(file)`
     - Calculate checksum using `this.calculateChecksum(buffer)`
     - Auto-detect content type using `this.detectContentType(filename)`
     - Upload to storage and return file record

   - `getFile(fileId)` - Retrieve file record from database
     - Query your backend's database for file metadata
     - Return `AttachmentFileRecord` or `null`

   - `deleteFile(fileId)` - Delete file from storage
     - Remove from storage backend
     - Remove file record from database
     - Only called for orphaned files (not referenced by any notifications)

   - `reconstructAttachmentFile(storageMetadata)` - Recreate file accessor
     - Create and return an `AttachmentFile` instance
     - Use storage metadata to configure access (e.g., S3 bucket/key)

   - `findFileByChecksum(checksum)` _(optional)_ - Enable file deduplication
     - Query database for existing file with same checksum
     - Return existing `AttachmentFileRecord` or `null`
     - Enables automatic deduplication when uploading identical files

5. **Implement the AttachmentFile class**:

   Create a storage-specific implementation of the `AttachmentFile` interface:

   - `read()` - Load entire file into memory as Buffer
   - `stream()` - Return ReadableStream for large files
   - `url(expiresIn?)` - Generate presigned/temporary URL for access
   - `delete()` - Delete file from storage

6. **Write comprehensive tests**:
   - Use the test template as a starting point
   - Test all methods with various file types
   - Test error handling
   - Use mocks for unit tests
   - Consider integration tests with real storage (or LocalStack/emulators)

7. **Document configuration**:
   - Document all configuration options
   - Provide usage examples
   - Document authentication methods
   - Include troubleshooting tips

**Example Implementation:**

See [`vintasend-aws-s3-attachments`](../vintasend-aws-s3-attachments) for a complete AWS S3 implementation that follows this pattern.

**Key Design Patterns:**

- **Reusable Files**: Files are stored once in `AttachmentFile` table and referenced by multiple notifications via `NotificationAttachment` join table
- **Deduplication**: Implement `findFileByChecksum()` to prevent storing duplicate files
- **Presigned URLs**: Generate temporary URLs for secure file access without exposing credentials
- **Streaming**: Support streaming for large files to avoid memory issues
- **Type Safety**: All methods use strict TypeScript types from `vintasend/dist/types/attachment`

## Other Components

### Adapter

Custom notification delivery adapters (email, SMS, push notifications, etc.)

**Examples:**
- `vintasend-nodemailer` - Email via Nodemailer
- Custom SMS adapter
- Custom push notification adapter

### Backend

Custom database persistence layers

**Examples:**
- `vintasend-prisma` - Prisma ORM backend
- Custom MongoDB backend
- Custom PostgreSQL backend

### Template Renderer

Custom notification content rendering

**Examples:**
- `vintasend-pug` - Pug template engine
- Custom Handlebars renderer
- Custom React email renderer

### Logger

Custom logging implementations

**Examples:**
- `vintasend-winston` - Winston logger
- Custom Pino logger
- Custom cloud logging service

## Getting Started

1. Choose the component type you want to implement
2. Copy this template package to a new directory
3. Follow the implementation steps for that component type
4. Write comprehensive tests
5. Document your implementation
6. Publish as a separate npm package (optional)

## Best Practices

- **Type Safety**: Use TypeScript strict mode and leverage VintaSend's type system
- **Testing**: Aim for high test coverage, including edge cases and error conditions
- **Documentation**: Document all configuration options and provide clear examples
- **Error Handling**: Provide clear error messages and proper error types
- **Performance**: Consider streaming for large files, connection pooling for databases, etc.
- **Security**: Never expose credentials, use presigned URLs, validate inputs

## Contributing

When creating implementations:
- Follow the existing code style (use Biome for linting)
- Include comprehensive tests
- Document all public APIs
- Add examples in README
- Consider adding to the main VintaSend monorepo

## License

MIT
