# /aws-deploy-check

Read-only audit of AWS resources before any infrastructure changes.

## RULE: Read first, change never without explicit instruction.

## Steps

```bash
# 1. Check active AWS identity
aws sts get-caller-identity 2>&1

# 2. List S3 buckets (file storage check)
aws s3 ls 2>&1 | head -20

# 3. Check for any EC2 instances (should be none — Vercel is serverless)
aws ec2 describe-instances --query "Reservations[*].Instances[*].[InstanceId,State.Name,InstanceType,LaunchTime]" --output table 2>&1

# 4. Check IAM users (audit for leaked credentials)
aws iam list-users --query "Users[*].[UserName,CreateDate]" --output table 2>&1

# 5. Check CloudWatch for any active alarms
aws cloudwatch describe-alarms --state-value ALARM --query "MetricAlarms[*].[AlarmName,StateReason]" --output table 2>&1
```

## What Lodgist Uses AWS For

- **S3**: Document storage for verification uploads (if implemented)
- **SES**: Email notifications (if implemented — check vs. Resend)
- **Nothing else** — all compute is Vercel, all DB is Neon

## Red Flags to Report Immediately

- Any EC2 instances you don't recognize → potential crypto miner from leaked SA key
- Any IAM users other than known accounts
- S3 buckets with public read access
- CloudWatch billing alarms triggered

## Output Format

```
## AWS Audit

### Identity
- Account: [ID]
- IAM User/Role: [name]

### Resources Found
- S3 buckets: [list]
- EC2 instances: NONE / [list with WARNING if unexpected]
- IAM users: [list]

### Red Flags
- [any unexpected resources]

### Safe to Proceed: YES / NO — [reason]
```
