# AWS Activate follow-on credits — application draft

**Follow-on AWS Activate application draft — verify the final amount and usage forecast before submitting**

OpenVault is a permission-aware knowledge platform that helps organizations get
cited answers from internal documents without giving users access to files they
are not allowed to see. The initial $1,000 AWS Startup credit grant supported
product development and brought the platform to launch-ready stage. We are
preparing to onboard our first users.

The selected launch architecture uses AWS Amplify for the static Next.js
frontend and Amazon Bedrock for managed AI inference/embeddings. Django, Render
PostgreSQL, and the initial document disk are hosted by Render. OpenVault filters
document permissions before retrieval and sends only approved passages to
Bedrock over TLS.

AWS credits can offset eligible Amplify and Bedrock charges, but they cannot pay
Render invoices. Do not describe Render compute, PostgreSQL, or disk as AWS
spend. For a planning example, 1,000 Bedrock questions at 3,000 input and 500
output tokens each are approximately $6–$7 at the modeled Haiku 4.5 rates, plus
Amplify hosting/build usage. Base the final requested amount on expected model
volume and AWS billing eligibility—not the earlier all-AWS ECS/RDS/EFS estimate.

Over the next 6–12 months, we plan to deploy the launch environment, onboard
early organizations, validate reliability and recovery, measure AI cost per
workspace, and scale only as user demand grows. The goal is to give early users
a secure, responsive experience while building a sustainable cross-cloud cost
profile.
