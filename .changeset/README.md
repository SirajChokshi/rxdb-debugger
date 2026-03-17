# Changesets

This repo uses [Changesets](https://github.com/changesets/changesets) for versioning and changelogs.

## Adding a changeset

After making a change, run:

```bash
bun changeset
```

Select the packages affected and describe the change. Commit the generated changeset file.

## Releasing

```bash
bun changeset version   # bumps versions and generates changelogs
bun run release          # builds and publishes to npm
```
