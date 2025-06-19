# SLBE MIS Automation Script

This is an automated script package for SLBE (SLB Ethanol Private Limited) that handles daily MIS (Management Information System) reports via email and WhatsApp.

## Features

- **Centralized Date Management**: All date configurations are managed from a single module
- **Automatic Retry Logic**: If yesterday's email/WhatsApp wasn't sent, it will be sent today
- **Multiple Report Types**: 
  - Coal availability alerts
  - Maize availability alerts
  - Daily MIS reports
  - Monthly MIS reports
  - WhatsApp notifications
- **Logging System**: Tracks sent emails and WhatsApp messages to prevent duplicates
- **Configurable**: Easy to modify date offsets and other settings

## Installation

1. Install dependencies:
```bash
npm install
```

2. Ensure Oracle Instant Client is installed at: `C:\oracle\instantclient_23_6`

3. Configure database connections in the respective files (Oracle and PostgreSQL credentials)

## Usage

Run the script:
```bash
npm start
```

Or directly:
```bash
node main.js
```

## How It Works

1. **Date Configuration**: The script uses `dateConfig.js` to manage all date-related operations
2. **Availability Checks**: Checks for coal, maize, and ethanol data availability
3. **Conditional Sending**: Only sends reports when all conditions are met
4. **Logging**: Maintains logs to prevent duplicate sends
5. **Retry Logic**: Automatically processes pending dates (up to 7 days back)

## File Structure

- `main.js` - Main orchestration script
- `dateConfig.js` - Centralized date management and logging
- `coalavailemail.js` - Coal availability email alerts
- `maizeavailemail.js` - Maize availability email alerts
- `ethanolData.js` - Ethanol data fetching
- `mis_email.js` - Daily MIS email reports
- `mis_email_month.js` - Monthly MIS email reports
- `mis_whatsapp.js` - WhatsApp notifications (placeholder)

## Configuration

### Date Offset
Modify `DATE_OFFSET` in `dateConfig.js` to change how many days back to check (default: 1)

### Email Recipients
Email recipients are managed through the PostgreSQL database in the `report_contacts` table.

### Logging
Logs are stored in `~/Documents/mis_logs/`:
- `email_log.json` - Email sending history
- `whatsapp_log.json` - WhatsApp sending history

## Scheduling

To run this script automatically, you can:

1. **Windows Task Scheduler**: Create a scheduled task to run the script daily
2. **Cron Job (Linux/Mac)**: Add to crontab for daily execution
3. **PM2**: Use PM2 for process management and scheduling

Example cron job (runs daily at 9 AM):
```bash
0 9 * * * cd /path/to/script && node main.js
```

## Error Handling

The script includes comprehensive error handling:
- Database connection errors
- Email sending failures
- Data fetching issues
- Graceful process termination

## Logs Location

All logs are stored in: `~/Documents/mis_logs/`

## Support

For issues or modifications, contact the development team.