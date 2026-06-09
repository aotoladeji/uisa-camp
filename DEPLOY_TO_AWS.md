# Deploy Frontend to S3 and Backend to EC2 — Step-by-step

This guide shows how to host the React frontend on S3 (optionally behind CloudFront) and the Node.js backend on an EC2 instance, plus how to run a local MySQL instance with Docker for development.

Prerequisites
- AWS account and IAM user with S3/EC2/Route53/ACM permissions
- AWS CLI configured locally (`aws configure`) or use AWS Console
- Domain in Route53 (optional)

1) Frontend: build and upload to S3
- Build the React app:
```bash
npm run build --prefix client
```
- Create an S3 bucket (unique name) and enable static website hosting. Use CloudFront for HTTPS in production.
- Upload built files:
```bash
aws s3 sync client/build/ s3://your-unique-bucket-name/ --delete
```

2) Backend: recommended production topology
- Use RDS (MySQL) for production DB. For quick setups you can run MySQL on a separate EC2 or use the Docker Compose below for dev.
- Launch an EC2 instance (Amazon Linux 2 or Ubuntu), open security group for SSH and HTTP/HTTPS.
- Install Node.js, clone repo, set `.env` values for production (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).
- Use `pm2` or `systemd` to run the Node app, and Nginx or ALB to handle SSL termination.

3) Local MySQL for development (Docker Compose)
- File: `server/docker-compose.yml` (included in repo). To run:
```bash
cd server
docker compose up -d
```
- This creates a MySQL 8 instance with:
  - DB_HOST=127.0.0.1
  - DB_PORT=3306
  - DB_NAME=uisa_camp
  - DB_USER=uisa_user
  - DB_PASSWORD=Network_admin

4) Update `server/.env` for local development (example)
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=uisa_user
DB_PASSWORD=Network_admin
DB_NAME=uisa_camp
DB_SSL=false

PORT=5000
NODE_ENV=development
JWT_SECRET=change_this_to_a_long_random_secret_string
```

5) Start server locally (after DB is ready)
```bash
cd server
npm install
node index.js
# or use pm2
pm2 start index.js --name uisa-camp
```

6) Production notes
- Use RDS for managed MySQL; secure DB with security groups restricting to EC2/ALB.
- Use CloudFront + ACM for global CDN and HTTPS for frontend.
- Use ALB + ACM to terminate HTTPS for backend, forward to EC2 targets.

Troubleshooting
- DB connection timed out: check security groups, firewall, and that DB is listening.
- Migration/schema: the server will auto-initialize the schema file `server/db/schema-mysql.sql` on startup; ensure DB user has CREATE and ALTER privileges during bootstrap.

If you want, I can also generate an `nginx` config, `systemd` unit, or an AWS CloudFormation / Terraform template to automate EC2 + S3 + CloudFront creation.
