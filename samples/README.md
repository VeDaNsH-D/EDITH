# edith sample EDI files

These files are ready for upload testing in the edith UI.

## Files

- `valid-837P.edi` — should parse as 837P and pass most validation checks.
- `malformed-837I.edi` — should parse as 837I and trigger multiple errors/warnings:
  - Invalid NPI in NM109
  - Invalid ZIP in N403
  - Invalid CLM05 facility/frequency in CLM05
  - Claim total mismatch (CLM02 vs service-line sum)
  - DOB/claim date inconsistency
  - Invalid date format in DTP03
  - Invalid SVC01/CPT format warning
- `sample-835.edi` — should parse as 835 and show remittance summary rows.
- `sample-834.edi` — should parse as 834 and show member enrollment summary rows.

## Quick run

1. Start backend and frontend.
2. Upload each file from this folder.
3. Use `malformed-837I.edi` to demo fix suggestions + revalidation loop.
