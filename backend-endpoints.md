# Backend Endpoints for QR Scanner App

## Required API Endpoints

### 1. Mark Item as Issued Endpoint
**PATCH** `/api/v1/users/{userId}/mark-item`

**Headers:**
```
X-Device-Id: qr-scanner-web-001
Authorization: Bearer {jwt_token}
```

**Request Body:**
```json
{
  "itemType": "LUNCH_COUPON" | "BAG"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item marked as issued",
  "data": null
}
```

**Notes:**
- Uses `@RequestParam` for `itemType` in the backend
- Requires `X-Device-Id` header for device tracking
- Path parameter `{userId}` identifies the user
- Only marks items as issued (no revoke functionality)

### 2. Scan History Endpoint
**GET** `/api/v1/scans/history`

**Response:**
```json
[
  {
    "result": "base64EncodedQRData",
    "timestamp": "2024-01-15T10:30:00Z",
    "type": "User QR",
    "userData": {
      "userID": 123,
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "displayName": "John Doe",
      "lunchCouponIssued": true,
      "bagIssued": false,
      "lastScanTime": "2024-01-15T10:30:00Z"
    },
    "itemsIssued": {
      "lunchCoupon": true,
      "bag": false
    },
    "scanStatus": "completed",
    "errorMessage": null
  }
]
```

### 3. User Update Endpoint
**PATCH** `/api/v1/users/{id}`

**Request Body:**
```json
{
  "lunchCouponIssued": true,
  "bagIssued": false,
  "lastScanTime": "2024-01-15T10:30:00Z"
}
```

## Backend Implementation

### Java Controller Method
```java
@PatchMapping("/{userId}/mark-item")
public ResponseEntity<ApiResponse> markItemIssued(
        @PathVariable Long userId,
        @RequestParam DomainConstants.ItemType itemType,
        @RequestHeader("X-Device-Id") String deviceId) throws AppsException {

    checkInService.markItemIssued(userId, itemType, deviceId);

    return ResponseEntity.ok(ApiResponse.success("Item marked as issued"));
}
```

### Domain Constants
```java
public enum ItemType {
    LUNCH_COUPON,
    BAG
}
```

## Database Schema Updates

### Users Table
Add the following columns to your users table:
```sql
ALTER TABLE users ADD COLUMN lunch_coupon_issued BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN bag_issued BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN last_scan_time TIMESTAMP;
```

### Scan History Table
Create a new table for tracking scan history:
```sql
CREATE TABLE scan_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  qr_data TEXT NOT NULL,
  scan_type VARCHAR(50) NOT NULL,
  scan_status VARCHAR(20) DEFAULT 'pending',
  items_issued JSONB,
  error_message TEXT,
  scanned_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Implementation Notes

1. **Authentication**: All endpoints require valid JWT tokens in the Authorization header
2. **Device Tracking**: `X-Device-Id` header is required for audit purposes
3. **Item Types**: Use enum values `LUNCH_COUPON` and `BAG` for itemType
4. **One-way Operation**: This endpoint only marks items as issued (no revoke)
5. **Error Handling**: Return appropriate HTTP status codes and error messages
6. **Rate Limiting**: Consider implementing rate limiting for item issuance endpoints
