# QR Scanner App with Item Issuance

A comprehensive QR code scanner application that allows users to scan QR codes and mark items like lunch coupons and bags as issued for users.

## Features

### 🎯 Core Functionality
- **QR Code Scanning**: Scan various types of QR codes including user QR codes
- **Item Issuance Tracking**: Mark lunch coupons and bags as issued for users
- **Real-time Updates**: WebSocket integration for live scan processing
- **User Authentication**: Secure login system with JWT tokens

### 📱 Item Management
- **Lunch Coupon Tracking**: Mark lunch coupons as issued (one-way operation)
- **Bag Issuance**: Track bag distribution status
- **Status Tracking**: Visual indicators for item status (pending, issued)
- **Audit Trail**: Complete history of all item issuance actions

### 📊 Dashboard & History
- **Scan History**: Detailed view of all scans with item status
- **Real-time Stats**: Live statistics of scanning activities
- **Status Indicators**: Color-coded status badges for easy identification
- **Search & Filter**: Easy navigation through scan history

## How It Works

### 1. Scanning Process
1. **Enable Camera**: Click "Scan QR Code" to activate the camera
2. **Scan QR Code**: Point camera at a QR code to scan
3. **Automatic Detection**: System detects if it's a user QR code
4. **Item Issuance**: For user QR codes, show item issuance interface

### 2. Item Issuance Flow
1. **User Identification**: System displays user information from QR code
2. **Item Selection**: Choose which items to mark as issued
3. **Mark as Issued**: Click "Mark as Issued" buttons
4. **Backend Sync**: Changes are sent to backend API via PATCH endpoint
5. **Success Confirmation**: Visual feedback with success/error messages

### 3. History Tracking
- All scans are automatically logged
- Item issuance status is tracked in real-time
- Complete audit trail of all actions
- Easy access to previous scans and status

## API Endpoints

The app requires the following backend endpoints:

- `PATCH /api/v1/users/{userId}/mark-item` - Mark items as issued
- `GET /api/v1/scans/history` - Retrieve scan history
- `PATCH /api/v1/users/{id}` - Update user status

See `backend-endpoints.md` for detailed API specifications.

## Installation & Setup

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Environment Configuration**
   ```bash
   # Create .env.local file
   NEXT_PUBLIC_API_BASE_URL=http://localhost:8081/api/v1
   NEXT_PUBLIC_API_BASE_URL_WITHOUT_VERSION=http://localhost:8081
   ```

3. **Run Development Server**
   ```bash
   pnpm dev
   ```

4. **Build for Production**
   ```bash
   pnpm build
   pnpm start
   ```

## Usage Examples

### Basic Scanning
1. Login to the application
2. Click "Scan QR Code" to enable camera
3. Scan any QR code
4. View results and take appropriate action

### User Item Issuance
1. Scan a user QR code (contains userID and email)
2. System displays user information
3. Use "Mark as Issued" buttons to mark items as distributed
4. Items can only be marked as issued (no revoke functionality)
5. All changes are synced with backend via PATCH endpoint

### Viewing History
1. Click "History" button in the header
2. Browse through all previous scans
3. See item issuance status for each user
4. Filter by scan type and status

## Technical Details

### Frontend Technologies
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Shadcn/ui**: Modern component library
- **WebSocket**: Real-time communication

### State Management
- **React Hooks**: Local state management
- **Context API**: Authentication state
- **Local Storage**: Token persistence

### Security Features
- **JWT Authentication**: Secure token-based auth
- **Password Encryption**: Client-side password hashing
- **Token Refresh**: Automatic token renewal
- **Secure Storage**: Local storage for tokens

### API Integration
- **PATCH Endpoint**: Uses `PATCH /users/{userId}/mark-item`
- **Device Tracking**: Sends `X-Device-Id` header for audit purposes
- **Item Types**: Supports `LUNCH_COUPON` and `BAG` enum values
- **One-way Operation**: Items can only be marked as issued

## Customization

### Adding New Item Types
1. Update `lib/types.ts` to include new item fields and enum values
2. Modify `components/scanner/scan-result.tsx` to handle new items
3. Update backend enum to support new item types
4. Modify scan history display for new items

### Styling Changes
- Modify `app/globals.css` for global styles
- Update component-specific styles in individual components
- Use Tailwind CSS classes for consistent design

## Troubleshooting

### Common Issues
1. **Camera Not Working**: Check browser permissions and HTTPS requirement
2. **WebSocket Connection**: Verify backend is running and accessible
3. **Authentication Errors**: Check token validity and refresh mechanism
4. **Item Issuance Fails**: Verify backend PATCH endpoint is working

### Debug Mode
Enable console logging by checking browser developer tools for detailed error information.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
