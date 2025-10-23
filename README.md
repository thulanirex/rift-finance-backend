# Rift Finance Hub - Backend Server

Express.js REST API server with MySQL database for the Rift Finance Hub application.

## Quick Start

### Prerequisites
- Node.js 18+ installed
- MySQL 8.0+ installed and running
- npm or yarn package manager

### Installation

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your MySQL credentials
```

3. **Create database and import schema**
```bash
# Login to MySQL
mysql -u root -p

# Create database
CREATE DATABASE rift_finance_hub;
exit;

# Import schema
mysql -u root -p rift_finance_hub < database/schema.sql
```

4. **Start the server**
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3001` (or the port specified in `.env`).

## Environment Variables

Create a `.env` file in the server directory with the following variables:

```env
# MySQL Database Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=rift_finance_hub

# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here_change_in_production
JWT_EXPIRES_IN=7d

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
```

## Project Structure

```
server/
├── config/
│   └── database.js          # MySQL connection pool configuration
├── database/
│   └── schema.sql           # MySQL database schema
├── middleware/
│   └── auth.js              # JWT authentication middleware
├── routes/
│   ├── auth.js              # Authentication endpoints
│   ├── users.js             # User management endpoints
│   ├── organizations.js     # Organization endpoints
│   ├── invoices.js          # Invoice endpoints
│   ├── pools.js             # Pool endpoints
│   ├── positions.js         # Position endpoints
│   ├── ledger.js            # Ledger endpoints
│   └── audit.js             # Audit log endpoints
├── index.js                 # Main application entry point
├── package.json             # Dependencies and scripts
└── .env.example             # Environment variables template
```

## API Documentation

### Authentication

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "role": "seller|buyer|funder|operator|admin",
  "orgId": "optional-org-uuid"
}

Response: { "token": "jwt-token", "user": {...} }
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

Response: { "token": "jwt-token", "user": {...} }
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>

Response: { "id": "...", "email": "...", "role": "...", ... }
```

### Protected Endpoints

All other endpoints require authentication. Include the JWT token in the Authorization header:

```http
Authorization: Bearer <your-jwt-token>
```

### Users

- `GET /api/users` - Get all users (operator/admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (operator/admin only)

### Organizations

- `GET /api/organizations` - Get organizations (filtered by role)
- `GET /api/organizations/:id` - Get organization by ID
- `POST /api/organizations` - Create organization
- `PUT /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization (operator/admin only)

### Invoices

- `GET /api/invoices` - Get invoices (filtered by role)
- `GET /api/invoices/:id` - Get invoice by ID
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice

### Pools

- `GET /api/pools` - Get all pools (public)
- `GET /api/pools/:id` - Get pool by ID
- `POST /api/pools` - Create pool (operator/admin only)
- `PUT /api/pools/:id` - Update pool (operator/admin only)
- `DELETE /api/pools/:id` - Delete pool (operator/admin only)

### Positions

- `GET /api/positions` - Get positions (filtered by role)
- `GET /api/positions/:id` - Get position by ID
- `POST /api/positions` - Create position
- `PUT /api/positions/:id` - Update position
- `DELETE /api/positions/:id` - Delete position (operator/admin only)

### Ledger

- `GET /api/ledger` - Get ledger entries (filtered by role)
- `POST /api/ledger` - Create ledger entry

### Audit

- `GET /api/audit` - Get audit logs (operator/admin only)
- `POST /api/audit` - Create audit log

## Database Schema

### Tables

- **auth_users**: Authentication credentials
- **users**: User profiles and roles
- **organizations**: Company information
- **wallets**: Crypto wallet addresses
- **invoices**: Invoice records
- **pools**: Liquidity pools
- **positions**: Funder positions
- **ledger_entries**: Financial transactions
- **audit_logs**: System audit trail
- **bank_accounts**: Bank account information
- **allowlist_wallets**: Whitelisted addresses

### User Roles

- `seller`: Can create and manage invoices
- `buyer`: Can view and purchase invoices
- `funder`: Can provide liquidity to pools
- `operator`: Platform operator with elevated permissions
- `admin`: Full system access

## Security Features

1. **JWT Authentication**: Secure token-based authentication
2. **Password Hashing**: bcrypt with salt rounds
3. **SQL Injection Prevention**: Parameterized queries
4. **CORS Protection**: Configurable CORS policy
5. **Helmet.js**: Security headers
6. **Role-Based Access Control**: Endpoint-level authorization

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Database Migrations

To add new migrations:
1. Create a new SQL file in `database/migrations/`
2. Run the migration manually or create a migration script

## Production Deployment

### Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET`
- [ ] Configure production database
- [ ] Set up SSL/TLS
- [ ] Configure proper CORS origins
- [ ] Set up database backups
- [ ] Configure logging
- [ ] Set up monitoring
- [ ] Use process manager (PM2, systemd)
- [ ] Set up reverse proxy (nginx)

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start server
pm2 start index.js --name rift-api

# Monitor
pm2 monit

# View logs
pm2 logs rift-api

# Restart
pm2 restart rift-api
```

### Using Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
```

## Troubleshooting

### Database Connection Issues

```bash
# Check MySQL is running
sudo systemctl status mysql

# Test connection
mysql -u root -p -e "SELECT 1"

# Check database exists
mysql -u root -p -e "SHOW DATABASES"
```

### Port Already in Use

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>
```

### JWT Token Issues

- Ensure `JWT_SECRET` is set in `.env`
- Check token hasn't expired
- Verify token format: `Bearer <token>`

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Proprietary - All rights reserved
