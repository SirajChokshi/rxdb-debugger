# RxDB Debugger - Vue Example

A Vue 3 + Vite app demonstrating [RxDB](https://rxdb.info/) with the `@rxdb-debugger/core` package and debugger UI, featuring a realistic music catalog database.

## Features

- **Music Catalog Database** with real artists, albums, songs, playlists, and users
- **9 Collections** with proper relationships (refs):
  - `artists` - 18 real artists (The Beatles, Pink Floyd, Kendrick Lamar, Taylor Swift, etc.)
  - `albums` - 35 real albums spanning 1965-2022
  - `songs` - 62 real tracks with play counts
  - `users` - 7 demo users with profile data and `nowPlayingSongId` refs into `songs`
  - `playlists` - 6 curated playlists (owned by users)
  - `playlistSongs` - Junction table linking playlists to songs
  - `userFollows` - Users following artists
  - `userLikes` - Users liking songs
  - `userFriends` - User-to-user edges for the friends activity graph
- **Live reactive queries** - All data updates in real-time
- **Search and filter** - Search by name, filter songs by genre
- **Event log** - Shows last 50 database change events
- **Debugger UI** - Full SolidJS-based debugger panel with collections, schema, and performance views
- **Mock replication sync** - Live `songs` and `users` replication with simulated remote updates for debugger demos
- **Collapsible friends rail** - Right-side panel derived from `userFriends -> users -> songs -> artists`

## Data Model

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ artists │◄────┤ albums  │◄────┤  songs  │
└────┬────┘     └─────────┘     └────┬────┘
     │                               │
     │ userFollows                   │ userLikes / nowPlayingSongId
     │                               │
     ▼                               ▼
┌─────────┐◄────┐   ┌───────────┐   ┌──────────────┐
│  users  │◄──┐ │   │ playlists │◄──┤playlistSongs │
└────┬────┘   │ │   └───────────┘   └──────────────┘
     │        │ │
     └────────┴─┘
       userFriends
```

## Real Music Data

The seed data includes iconic albums and songs from the last 60 years:

- **1960s-70s**: The Beatles (Abbey Road, Sgt. Pepper's), Pink Floyd (Dark Side of the Moon), Led Zeppelin IV
- **1980s**: Michael Jackson (Thriller), Prince (Purple Rain), U2 (The Joshua Tree)
- **1990s**: Nirvana (Nevermind), Radiohead (OK Computer)
- **2000s-2020s**: Kanye West (MBDTF), Kendrick Lamar (DAMN.), Taylor Swift (1989, Folklore), Beyoncé (Lemonade, Renaissance), Frank Ocean (Blonde)

## Prerequisites

Build the core package first:

```bash
# From the repo root
bun run build
```

## Running the Example

```bash
# Install dependencies (from examples/vue)
bun install

# Start the dev server
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

The example configures mock replication for `songs` and `users`. Open the debugger and use the **Replication** panel to inspect:

- Active/paused replication state
- Sent and received counters
- Initial sync and in-sync status
- Recent replication errors
- Manual `ReSync` / pause-resume controls

The right-side friends rail updates every ~30 seconds by following replicated user documents through the `userFriends` graph.

## Chrome DevTools Extension Integration

This example installs the RxDB Debugger auto-discovery plugin at startup via:

```ts
installRxdbDebuggerAutoDiscovery();
```

That means the extension can discover databases and instances automatically, without assigning a database to `window`.

If you open multiple handles to the same underlying database, the extension groups them under one logical database and shows each handle as a separate instance.

## Optional Encryption Demo Mode

The example can run with encrypted fields so you can validate debugger metadata chips and encrypted document reads through an open database handle.

Set these environment variables before starting the app:

```bash
VITE_RXDB_DEBUGGER_ENABLE_ENCRYPTION=true
VITE_RXDB_DEBUGGER_DB_PASSWORD=your-local-dev-password
```

In encryption mode, the example encrypts:
- `artists.bio`
- `users.email`
- `users.birthDate`

The DevTools explorer will show encryption/password metadata badges. The password itself is not exposed in debugger metadata.

## Project Structure

```
examples/vue/
├── src/
│   ├── main.ts              # Vue entry point
│   ├── App.vue              # Demo shell, debugger dock, and navigation
│   ├── composables/         # RxDB subscriptions and app state
│   ├── views/               # Home, artists, albums, songs, playlists
│   ├── components/          # Shared UI pieces
│   └── db.ts                # RxDB schemas, seed data, and database setup
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```
