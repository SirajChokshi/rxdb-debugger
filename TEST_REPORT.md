# RxDB Debugger Query Filtering Test Report

## Test Date: February 4, 2026

## Summary

Testing of the query filtering functionality in the RxDB Debugger application revealed that **JSON mode filtering works correctly**, while **Builder mode filtering has a bug** where filters are not properly applied.

## Test Environment

- Application: RxTunes (React demo app at http://localhost:5174)
- Database: RxDB with demo data loaded (126 documents total)
- Collections tested: `songs` (62 documents)

## Test Results

### JSON Mode Filtering ✅ WORKING

| Query | Filter | Results | Status |
|-------|--------|---------|--------|
| `{"selector": {}, "limit": 25}` | No filter | 25 results | ✅ |
| `{"selector": {"genre": {"$eq": "Rock"}}, "limit": 25}` | Rock genre | 11 results | ✅ |
| `{"selector": {"genre": {"$eq": "Pop"}}, "limit": 25}` | Pop genre | 7 results | ✅ |

The JSON mode correctly filters documents based on the selector criteria. Different genre filters return different result counts as expected.

### Builder Mode Filtering ❌ BUG FOUND

| Action | Expected | Actual | Status |
|--------|----------|--------|--------|
| Added filter: field=genre, operator=, value=Pop | Results filtered to Pop songs | Results still showed Rock songs (11 results, same as previous Rock query) | ❌ |
| Switched back to JSON mode | Query should show Pop filter | Query still showed Rock filter | ❌ |

**Issue Description:**
The Builder mode UI allows users to add filter conditions (field, operator, value), but when "Run Query" is clicked, the filter values entered in Builder mode are not applied to the actual query execution. The query continues to use the last JSON mode query instead.

**Expected Behavior:**
When a filter is added in Builder mode and "Run Query" is clicked, the query should be constructed from the Builder filters and executed.

**Actual Behavior:**
Builder mode filters are not synchronized with query execution. The filters appear in the UI but are ignored when running the query.

## Recommendations

1. Investigate the Builder mode query construction logic in `QueryPanel.tsx`
2. Ensure Builder mode filters are properly converted to a query object before execution
3. Consider adding a visual indicator when Builder/JSON modes are synced or not

## Screenshots

- JSON mode with Rock filter: 11 results returned correctly
- JSON mode with Pop filter: 7 results returned correctly  
- Builder mode with Pop filter: 11 results returned (incorrect - should be 7)
