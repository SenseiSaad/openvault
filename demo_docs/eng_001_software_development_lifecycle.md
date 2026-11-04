# Software Development Lifecycle

**Document code:** ENG-001  
**Owner:** Group Engineering  
**Applies to:** OpenVault Global and all wholly owned subsidiaries  
**Version:** 3.2  
**Classification:** Internal - staff and authorised contractors  
**Effective date:** 2026-01-01  
**Next review:** 2027-01-01  
**Approved by:** Group Policy Committee  

---

## 1. Document control

| Field | Value |
| --- | --- |
| Publisher | OpenVault Global Group Secretariat |
| Policy owner | Group Engineering |
| Review cycle | Annual, or on material regulatory change |
| Supersedes | All prior versions of this document |
| Contact | policy@openvault.example |

This document is maintained under the Group Document Control Standard. Changes require an approved change request, a documented impact assessment, and a communication note to all affected teams.

## 2. Policy area: Requirements

- Features start with a reviewed requirement and acceptance criteria.
- Design reviews are required for cross-service changes.
- Trunk-based development with short-lived branches is the default.
- Every pull request requires one approving review.
- Automated tests must pass before merge.
- All requirements records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in Karachi confirm local applicability of requirements.
- Questions about requirements are logged in the policy query register.
- Any change to requirements requires an impact note and an owner sign-off.
- Supporting templates for requirements are published on the intranet.

### 2.1 Operational notes

Managers in Islamabad are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 3. Policy area: Design Review

- Design reviews are required for cross-service changes.
- Trunk-based development with short-lived branches is the default.
- Every pull request requires one approving review.
- Automated tests must pass before merge.
- Continuous integration builds every commit.
- All design review records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in Lahore confirm local applicability of design review.
- Questions about design review are logged in the policy query register.
- Any change to design review requires an impact note and an owner sign-off.
- Supporting templates for design review are published on the intranet.

### 3.1 Operational notes

Managers in Dubai are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 4. Policy area: Branching

- Trunk-based development with short-lived branches is the default.
- Every pull request requires one approving review.
- Automated tests must pass before merge.
- Continuous integration builds every commit.
- Production deployments use staged rollouts.
- All branching records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in Islamabad confirm local applicability of branching.
- Questions about branching are logged in the policy query register.
- Any change to branching requires an impact note and an owner sign-off.
- Supporting templates for branching are published on the intranet.

### 4.1 Operational notes

Managers in London are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 5. Policy area: Code Review

- Every pull request requires one approving review.
- Automated tests must pass before merge.
- Continuous integration builds every commit.
- Production deployments use staged rollouts.
- Rollback plans are documented for each release.
- All code review records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in Dubai confirm local applicability of code review.
- Questions about code review are logged in the policy query register.
- Any change to code review requires an impact note and an owner sign-off.
- Supporting templates for code review are published on the intranet.

### 5.1 Operational notes

Managers in Singapore are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 6. Policy area: Testing

- Automated tests must pass before merge.
- Continuous integration builds every commit.
- Production deployments use staged rollouts.
- Rollback plans are documented for each release.
- Secrets are stored in the managed secret store only.
- All testing records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in London confirm local applicability of testing.
- Questions about testing are logged in the policy query register.
- Any change to testing requires an impact note and an owner sign-off.
- Supporting templates for testing are published on the intranet.

### 6.1 Operational notes

Managers in Austin are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 7. Policy area: Ci

- Continuous integration builds every commit.
- Production deployments use staged rollouts.
- Rollback plans are documented for each release.
- Secrets are stored in the managed secret store only.
- Third-party dependencies are scanned for vulnerabilities.
- All CI records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in Singapore confirm local applicability of CI.
- Questions about CI are logged in the policy query register.
- Any change to CI requires an impact note and an owner sign-off.
- Supporting templates for CI are published on the intranet.

### 7.1 Operational notes

Managers in Karachi are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 8. Policy area: Deployment

- Production deployments use staged rollouts.
- Rollback plans are documented for each release.
- Secrets are stored in the managed secret store only.
- Third-party dependencies are scanned for vulnerabilities.
- Architecture decision records accompany significant changes.
- All deployment records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in Austin confirm local applicability of deployment.
- Questions about deployment are logged in the policy query register.
- Any change to deployment requires an impact note and an owner sign-off.
- Supporting templates for deployment are published on the intranet.

### 8.1 Operational notes

Managers in Lahore are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 9. Policy area: Rollback

- Rollback plans are documented for each release.
- Secrets are stored in the managed secret store only.
- Third-party dependencies are scanned for vulnerabilities.
- Architecture decision records accompany significant changes.
- Incident postmortems follow the blameless format.
- All rollback records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in Karachi confirm local applicability of rollback.
- Questions about rollback are logged in the policy query register.
- Any change to rollback requires an impact note and an owner sign-off.
- Supporting templates for rollback are published on the intranet.

### 9.1 Operational notes

Managers in Islamabad are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 10. Policy area: Secrets

- Secrets are stored in the managed secret store only.
- Third-party dependencies are scanned for vulnerabilities.
- Architecture decision records accompany significant changes.
- Incident postmortems follow the blameless format.
- Features start with a reviewed requirement and acceptance criteria.
- All secrets records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in Lahore confirm local applicability of secrets.
- Questions about secrets are logged in the policy query register.
- Any change to secrets requires an impact note and an owner sign-off.
- Supporting templates for secrets are published on the intranet.

### 10.1 Operational notes

Managers in Dubai are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 11. Policy area: Dependencies

- Third-party dependencies are scanned for vulnerabilities.
- Architecture decision records accompany significant changes.
- Incident postmortems follow the blameless format.
- Features start with a reviewed requirement and acceptance criteria.
- Design reviews are required for cross-service changes.
- All dependencies records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in Islamabad confirm local applicability of dependencies.
- Questions about dependencies are logged in the policy query register.
- Any change to dependencies requires an impact note and an owner sign-off.
- Supporting templates for dependencies are published on the intranet.

### 11.1 Operational notes

Managers in London are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 12. Policy area: Documentation

- Architecture decision records accompany significant changes.
- Incident postmortems follow the blameless format.
- Features start with a reviewed requirement and acceptance criteria.
- Design reviews are required for cross-service changes.
- Trunk-based development with short-lived branches is the default.
- All documentation records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in Dubai confirm local applicability of documentation.
- Questions about documentation are logged in the policy query register.
- Any change to documentation requires an impact note and an owner sign-off.
- Supporting templates for documentation are published on the intranet.

### 12.1 Operational notes

Managers in Singapore are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 13. Policy area: Postmortem

- Incident postmortems follow the blameless format.
- Features start with a reviewed requirement and acceptance criteria.
- Design reviews are required for cross-service changes.
- Trunk-based development with short-lived branches is the default.
- Every pull request requires one approving review.
- All postmortem records are reviewed by Group Engineering at each quarterly cycle.
- Regional leads in London confirm local applicability of postmortem.
- Questions about postmortem are logged in the policy query register.
- Any change to postmortem requires an impact note and an owner sign-off.
- Supporting templates for postmortem are published on the intranet.

### 13.1 Operational notes

Managers in Austin are responsible for applying this section consistently. Exceptions must be recorded in the policy exception register with a named approver and an expiry date.

Evidence of compliance is retained for seven years in the group records repository. Internal Audit samples this section each quarter.

## 14. Frequently asked questions

**Q: Who owns this document?**

The named policy owner in the document control table.

**Q: How often is it reviewed?**

At least once per year or on material change.

**Q: Where do I raise a question?**

Contact the policy owner or the service desk.

**Q: Does this apply to contractors?**

Yes, where the contract references group policy.

**Q: How are exceptions handled?**

Through the documented exception register.

**Q: Which office is responsible?**

The regional lead listed in the office directory.

**Q: What evidence is retained?**

Records listed in the retention schedule.

**Q: When was it last approved?**

See the version and effective date above.

**Q: Who approves changes?**

The Group Policy Committee or its delegate.

**Q: How is compliance measured?**

Quarterly sampling by Internal Audit.

## 15. Related documents

- Group Document Control Standard (GOV-003)
- Information Security Policy (SEC-001)
- Employee Code of Conduct (HR-003)
- Records Retention Schedule (GOV-003)

## 16. Revision history

| Version | Date | Change | Author |
| --- | --- | --- | --- |
| 1.0 | 2021-04-12 | Initial publication | Group Secretariat |
| 2.0 | 2023-02-08 | Regional alignment | Policy Committee |
| 3.0 | 2025-06-19 | Added hybrid-work clauses | Policy Committee |
| 3.2 | 2026-01-01 | Annual review, Software Development Lifecycle | Group Engineering |

## 17. Appendix A - Regional applicability

| Office | Applies | Local contact |
| --- | --- | --- |
| Karachi | Yes | karachi@openvault.example |
| Lahore | Yes | lahore@openvault.example |
| Islamabad | Yes | islamabad@openvault.example |
| Dubai | Yes | dubai@openvault.example |
| London | Yes | london@openvault.example |
| Singapore | Yes | singapore@openvault.example |
| Austin | Yes | austin@openvault.example |

## 18. Appendix B - Definitions

- **requirements**: Features start with a reviewed requirement and acceptance criteria.
- **design review**: Design reviews are required for cross-service changes.
- **branching**: Trunk-based development with short-lived branches is the default.
- **code review**: Every pull request requires one approving review.
- **testing**: Automated tests must pass before merge.
- **CI**: Continuous integration builds every commit.
- **deployment**: Production deployments use staged rollouts.
- **rollback**: Rollback plans are documented for each release.
- **secrets**: Secrets are stored in the managed secret store only.
- **dependencies**: Third-party dependencies are scanned for vulnerabilities.
- **documentation**: Architecture decision records accompany significant changes.
- **postmortem**: Incident postmortems follow the blameless format.

