# Services

บริการกลางที่ต้องสร้างเป็น Edge Functions หรือ server-side services

- `check-availability`
- `create-booking-hold`
- `calculate-booking-price`
- `create-payment`
- `payment-webhook`
- `confirm-booking`
- `expire-unpaid-bookings`
- `upload-health-document`
- `request-cancellation`
- `review-refund`
- `line-webhook`
- `send-booking-reminders`

ทุก endpoint ที่เปลี่ยนสถานะต้องรองรับ idempotency และ audit log

