import type { Album } from "./types.js";

export const ALBUMS: Album[] = [
  // The Beatles
  { id: "album-abbeyroad", title: "Abbey Road", artistId: "artist-beatles", releaseYear: 1969, genre: "Rock", label: "Apple Records", totalTracks: 17 },
  { id: "album-sgtpepper", title: "Sgt. Pepper's Lonely Hearts Club Band", artistId: "artist-beatles", releaseYear: 1967, genre: "Psychedelic Rock", label: "Parlophone", totalTracks: 13 },
  { id: "album-revolver", title: "Revolver", artistId: "artist-beatles", releaseYear: 1966, genre: "Rock", label: "Parlophone", totalTracks: 14 },
  // Pink Floyd
  { id: "album-darkside", title: "The Dark Side of the Moon", artistId: "artist-pinkfloyd", releaseYear: 1973, genre: "Progressive Rock", label: "Harvest", totalTracks: 10 },
  { id: "album-thewishyouwerehere", title: "Wish You Were Here", artistId: "artist-pinkfloyd", releaseYear: 1975, genre: "Progressive Rock", label: "Harvest", totalTracks: 5 },
  // Led Zeppelin
  { id: "album-ledzeppeliniv", title: "Led Zeppelin IV", artistId: "artist-ledzeppelin", releaseYear: 1971, genre: "Hard Rock", label: "Atlantic", totalTracks: 8 },
  { id: "album-physicalgraffiti", title: "Physical Graffiti", artistId: "artist-ledzeppelin", releaseYear: 1975, genre: "Hard Rock", label: "Swan Song", totalTracks: 15 },
  // Michael Jackson
  { id: "album-thriller", title: "Thriller", artistId: "artist-michaeljackson", releaseYear: 1982, genre: "Pop", label: "Epic", totalTracks: 9 },
  { id: "album-bad", title: "Bad", artistId: "artist-michaeljackson", releaseYear: 1987, genre: "Pop", label: "Epic", totalTracks: 11 },
  // Prince
  { id: "album-purplerain", title: "Purple Rain", artistId: "artist-prince", releaseYear: 1984, genre: "Funk", label: "Warner Bros.", totalTracks: 9 },
  { id: "album-1999", title: "1999", artistId: "artist-prince", releaseYear: 1982, genre: "Funk", label: "Warner Bros.", totalTracks: 11 },
  // Nirvana
  { id: "album-nevermind", title: "Nevermind", artistId: "artist-nirvana", releaseYear: 1991, genre: "Grunge", label: "DGC", totalTracks: 12 },
  { id: "album-inutero", title: "In Utero", artistId: "artist-nirvana", releaseYear: 1993, genre: "Grunge", label: "DGC", totalTracks: 12 },
  // Radiohead
  { id: "album-okcomputer", title: "OK Computer", artistId: "artist-radiohead", releaseYear: 1997, genre: "Alternative Rock", label: "Parlophone", totalTracks: 12 },
  { id: "album-kida", title: "Kid A", artistId: "artist-radiohead", releaseYear: 2000, genre: "Electronic", label: "Parlophone", totalTracks: 10 },
  { id: "album-inrainbows", title: "In Rainbows", artistId: "artist-radiohead", releaseYear: 2007, genre: "Alternative Rock", label: "XL", totalTracks: 10 },
  // Kendrick Lamar
  { id: "album-gkmc", title: "good kid, m.A.A.d city", artistId: "artist-kendrick", releaseYear: 2012, genre: "Hip-Hop", label: "TDE", totalTracks: 12 },
  { id: "album-tpab", title: "To Pimp a Butterfly", artistId: "artist-kendrick", releaseYear: 2015, genre: "Hip-Hop", label: "TDE", totalTracks: 16 },
  { id: "album-damn", title: "DAMN.", artistId: "artist-kendrick", releaseYear: 2017, genre: "Hip-Hop", label: "TDE", totalTracks: 14 },
  // Kanye West
  { id: "album-collegedropout", title: "The College Dropout", artistId: "artist-kanye", releaseYear: 2004, genre: "Hip-Hop", label: "Roc-A-Fella", totalTracks: 21 },
  { id: "album-mbdtf", title: "My Beautiful Dark Twisted Fantasy", artistId: "artist-kanye", releaseYear: 2010, genre: "Hip-Hop", label: "Roc-A-Fella", totalTracks: 13 },
  { id: "album-yeezus", title: "Yeezus", artistId: "artist-kanye", releaseYear: 2013, genre: "Hip-Hop", label: "Def Jam", totalTracks: 10 },
  // Taylor Swift
  { id: "album-1989", title: "1989", artistId: "artist-taylorswift", releaseYear: 2014, genre: "Pop", label: "Big Machine", totalTracks: 13 },
  { id: "album-folklore", title: "Folklore", artistId: "artist-taylorswift", releaseYear: 2020, genre: "Indie Folk", label: "Republic", totalTracks: 16 },
  { id: "album-midnights", title: "Midnights", artistId: "artist-taylorswift", releaseYear: 2022, genre: "Pop", label: "Republic", totalTracks: 13 },
  // Beyoncé
  { id: "album-lemonade", title: "Lemonade", artistId: "artist-beyonce", releaseYear: 2016, genre: "R&B", label: "Parkwood", totalTracks: 12 },
  { id: "album-renaissance", title: "Renaissance", artistId: "artist-beyonce", releaseYear: 2022, genre: "Dance", label: "Parkwood", totalTracks: 16 },
  // Fleetwood Mac
  { id: "album-rumours", title: "Rumours", artistId: "artist-fleetwoodmac", releaseYear: 1977, genre: "Rock", label: "Warner Bros.", totalTracks: 11 },
  // Stevie Wonder
  { id: "album-songsinkey", title: "Songs in the Key of Life", artistId: "artist-steviewonder", releaseYear: 1976, genre: "R&B", label: "Tamla", totalTracks: 21 },
  // Frank Ocean
  { id: "album-blonde", title: "Blonde", artistId: "artist-frankocean", releaseYear: 2016, genre: "R&B", label: "Boys Don't Cry", totalTracks: 17 },
  { id: "album-channelorange", title: "Channel Orange", artistId: "artist-frankocean", releaseYear: 2012, genre: "R&B", label: "Def Jam", totalTracks: 17 },
  // David Bowie
  { id: "album-ziggystardust", title: "The Rise and Fall of Ziggy Stardust and the Spiders from Mars", artistId: "artist-davidbowie", releaseYear: 1972, genre: "Glam Rock", label: "RCA", totalTracks: 11 },
  // U2
  { id: "album-joshuatree", title: "The Joshua Tree", artistId: "artist-u2", releaseYear: 1987, genre: "Rock", label: "Island", totalTracks: 11 },
  // Queen
  { id: "album-nightatopera", title: "A Night at the Opera", artistId: "artist-queen", releaseYear: 1975, genre: "Rock", label: "EMI", totalTracks: 12 },
  // Bob Dylan
  { id: "album-highway61", title: "Highway 61 Revisited", artistId: "artist-bobdylan", releaseYear: 1965, genre: "Folk Rock", label: "Columbia", totalTracks: 9 },
];
