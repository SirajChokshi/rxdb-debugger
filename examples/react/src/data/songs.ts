import type { Song } from "./types.js";

export const SONGS: Song[] = [
  // Abbey Road
  { id: "song-cometogether", title: "Come Together", artistId: "artist-beatles", albumId: "album-abbeyroad", trackNumber: 1, durationMs: 259000, genre: "Rock", playCount: 1200000000 },
  { id: "song-something", title: "Something", artistId: "artist-beatles", albumId: "album-abbeyroad", trackNumber: 2, durationMs: 182000, genre: "Rock", playCount: 850000000 },
  { id: "song-herecomesthesun", title: "Here Comes the Sun", artistId: "artist-beatles", albumId: "album-abbeyroad", trackNumber: 7, durationMs: 185000, genre: "Rock", playCount: 1500000000 },
  { id: "song-octopusgarden", title: "Octopus's Garden", artistId: "artist-beatles", albumId: "album-abbeyroad", trackNumber: 5, durationMs: 171000, genre: "Rock", playCount: 320000000 },
  // Sgt. Pepper's
  { id: "song-lucyinthesky", title: "Lucy in the Sky with Diamonds", artistId: "artist-beatles", albumId: "album-sgtpepper", trackNumber: 3, durationMs: 207000, genre: "Psychedelic Rock", playCount: 680000000 },
  { id: "song-adayinthelife", title: "A Day in the Life", artistId: "artist-beatles", albumId: "album-sgtpepper", trackNumber: 13, durationMs: 337000, genre: "Psychedelic Rock", playCount: 520000000 },
  // Dark Side of the Moon
  { id: "song-money", title: "Money", artistId: "artist-pinkfloyd", albumId: "album-darkside", trackNumber: 6, durationMs: 382000, genre: "Progressive Rock", playCount: 920000000 },
  { id: "song-time", title: "Time", artistId: "artist-pinkfloyd", albumId: "album-darkside", trackNumber: 4, durationMs: 413000, genre: "Progressive Rock", playCount: 780000000 },
  { id: "song-breathe", title: "Breathe (In the Air)", artistId: "artist-pinkfloyd", albumId: "album-darkside", trackNumber: 2, durationMs: 169000, genre: "Progressive Rock", playCount: 450000000 },
  // Led Zeppelin IV
  { id: "song-stairwaytoheaven", title: "Stairway to Heaven", artistId: "artist-ledzeppelin", albumId: "album-ledzeppeliniv", trackNumber: 4, durationMs: 482000, genre: "Hard Rock", playCount: 1100000000 },
  { id: "song-blackdog", title: "Black Dog", artistId: "artist-ledzeppelin", albumId: "album-ledzeppeliniv", trackNumber: 1, durationMs: 295000, genre: "Hard Rock", playCount: 620000000 },
  { id: "song-rockandroll", title: "Rock and Roll", artistId: "artist-ledzeppelin", albumId: "album-ledzeppeliniv", trackNumber: 2, durationMs: 220000, genre: "Hard Rock", playCount: 480000000 },
  // Thriller
  { id: "song-thriller", title: "Thriller", artistId: "artist-michaeljackson", albumId: "album-thriller", trackNumber: 4, durationMs: 357000, genre: "Pop", playCount: 1800000000 },
  { id: "song-billiejean", title: "Billie Jean", artistId: "artist-michaeljackson", albumId: "album-thriller", trackNumber: 6, durationMs: 294000, genre: "Pop", playCount: 2100000000 },
  { id: "song-beatit", title: "Beat It", artistId: "artist-michaeljackson", albumId: "album-thriller", trackNumber: 5, durationMs: 258000, genre: "Pop", playCount: 1400000000 },
  { id: "song-humanature", title: "Human Nature", artistId: "artist-michaeljackson", albumId: "album-thriller", trackNumber: 7, durationMs: 246000, genre: "Pop", playCount: 680000000 },
  // Purple Rain
  { id: "song-purplerain", title: "Purple Rain", artistId: "artist-prince", albumId: "album-purplerain", trackNumber: 9, durationMs: 521000, genre: "Funk", playCount: 890000000 },
  { id: "song-whendovescry", title: "When Doves Cry", artistId: "artist-prince", albumId: "album-purplerain", trackNumber: 5, durationMs: 352000, genre: "Funk", playCount: 720000000 },
  { id: "song-letsgocrazy", title: "Let's Go Crazy", artistId: "artist-prince", albumId: "album-purplerain", trackNumber: 1, durationMs: 284000, genre: "Funk", playCount: 540000000 },
  // Nevermind
  { id: "song-smellsliketeenspirit", title: "Smells Like Teen Spirit", artistId: "artist-nirvana", albumId: "album-nevermind", trackNumber: 1, durationMs: 301000, genre: "Grunge", playCount: 1900000000 },
  { id: "song-comeasura", title: "Come as You Are", artistId: "artist-nirvana", albumId: "album-nevermind", trackNumber: 3, durationMs: 218000, genre: "Grunge", playCount: 1200000000 },
  { id: "song-lithium", title: "Lithium", artistId: "artist-nirvana", albumId: "album-nevermind", trackNumber: 5, durationMs: 257000, genre: "Grunge", playCount: 780000000 },
  // OK Computer
  { id: "song-paranoidandroid", title: "Paranoid Android", artistId: "artist-radiohead", albumId: "album-okcomputer", trackNumber: 2, durationMs: 383000, genre: "Alternative Rock", playCount: 420000000 },
  { id: "song-karma", title: "Karma Police", artistId: "artist-radiohead", albumId: "album-okcomputer", trackNumber: 6, durationMs: 264000, genre: "Alternative Rock", playCount: 680000000 },
  { id: "song-nosuprises", title: "No Surprises", artistId: "artist-radiohead", albumId: "album-okcomputer", trackNumber: 10, durationMs: 227000, genre: "Alternative Rock", playCount: 520000000 },
  // good kid, m.A.A.d city
  { id: "song-swimmingpools", title: "Swimming Pools (Drank)", artistId: "artist-kendrick", albumId: "album-gkmc", trackNumber: 8, durationMs: 313000, genre: "Hip-Hop", playCount: 1100000000 },
  { id: "song-maadcity", title: "m.A.A.d city", artistId: "artist-kendrick", albumId: "album-gkmc", trackNumber: 10, durationMs: 359000, genre: "Hip-Hop", playCount: 650000000 },
  { id: "song-backseatfreestyle", title: "Backseat Freestyle", artistId: "artist-kendrick", albumId: "album-gkmc", trackNumber: 4, durationMs: 213000, genre: "Hip-Hop", playCount: 520000000 },
  // To Pimp a Butterfly
  { id: "song-alright", title: "Alright", artistId: "artist-kendrick", albumId: "album-tpab", trackNumber: 7, durationMs: 219000, genre: "Hip-Hop", playCount: 980000000 },
  { id: "song-kingkunta", title: "King Kunta", artistId: "artist-kendrick", albumId: "album-tpab", trackNumber: 3, durationMs: 234000, genre: "Hip-Hop", playCount: 720000000 },
  // DAMN.
  { id: "song-humble", title: "HUMBLE.", artistId: "artist-kendrick", albumId: "album-damn", trackNumber: 8, durationMs: 177000, genre: "Hip-Hop", playCount: 2300000000 },
  { id: "song-dna", title: "DNA.", artistId: "artist-kendrick", albumId: "album-damn", trackNumber: 2, durationMs: 185000, genre: "Hip-Hop", playCount: 1400000000 },
  // My Beautiful Dark Twisted Fantasy
  { id: "song-runaway", title: "Runaway", artistId: "artist-kanye", albumId: "album-mbdtf", trackNumber: 5, durationMs: 548000, genre: "Hip-Hop", playCount: 820000000 },
  { id: "song-power", title: "Power", artistId: "artist-kanye", albumId: "album-mbdtf", trackNumber: 3, durationMs: 292000, genre: "Hip-Hop", playCount: 1100000000 },
  { id: "song-allofthelights", title: "All of the Lights", artistId: "artist-kanye", albumId: "album-mbdtf", trackNumber: 6, durationMs: 295000, genre: "Hip-Hop", playCount: 940000000 },
  // The College Dropout
  { id: "song-jesuswalks", title: "Jesus Walks", artistId: "artist-kanye", albumId: "album-collegedropout", trackNumber: 11, durationMs: 193000, genre: "Hip-Hop", playCount: 580000000 },
  { id: "song-throughthewire", title: "Through the Wire", artistId: "artist-kanye", albumId: "album-collegedropout", trackNumber: 14, durationMs: 231000, genre: "Hip-Hop", playCount: 420000000 },
  // 1989
  { id: "song-shakeitoff", title: "Shake It Off", artistId: "artist-taylorswift", albumId: "album-1989", trackNumber: 6, durationMs: 219000, genre: "Pop", playCount: 3200000000 },
  { id: "song-blankspace", title: "Blank Space", artistId: "artist-taylorswift", albumId: "album-1989", trackNumber: 2, durationMs: 231000, genre: "Pop", playCount: 2800000000 },
  { id: "song-badblood", title: "Bad Blood", artistId: "artist-taylorswift", albumId: "album-1989", trackNumber: 8, durationMs: 211000, genre: "Pop", playCount: 1600000000 },
  // Folklore
  { id: "song-cardigan", title: "Cardigan", artistId: "artist-taylorswift", albumId: "album-folklore", trackNumber: 2, durationMs: 239000, genre: "Indie Folk", playCount: 1200000000 },
  { id: "song-exile", title: "Exile", artistId: "artist-taylorswift", albumId: "album-folklore", trackNumber: 4, durationMs: 288000, genre: "Indie Folk", playCount: 820000000 },
  { id: "song-august", title: "August", artistId: "artist-taylorswift", albumId: "album-folklore", trackNumber: 8, durationMs: 261000, genre: "Indie Folk", playCount: 940000000 },
  // Lemonade
  { id: "song-formation", title: "Formation", artistId: "artist-beyonce", albumId: "album-lemonade", trackNumber: 12, durationMs: 206000, genre: "R&B", playCount: 720000000 },
  { id: "song-sorry", title: "Sorry", artistId: "artist-beyonce", albumId: "album-lemonade", trackNumber: 4, durationMs: 231000, genre: "R&B", playCount: 580000000 },
  { id: "song-holdupbey", title: "Hold Up", artistId: "artist-beyonce", albumId: "album-lemonade", trackNumber: 2, durationMs: 222000, genre: "R&B", playCount: 420000000 },
  // Rumours
  { id: "song-dreams", title: "Dreams", artistId: "artist-fleetwoodmac", albumId: "album-rumours", trackNumber: 3, durationMs: 257000, genre: "Rock", playCount: 1400000000 },
  { id: "song-goyourownway", title: "Go Your Own Way", artistId: "artist-fleetwoodmac", albumId: "album-rumours", trackNumber: 5, durationMs: 218000, genre: "Rock", playCount: 920000000 },
  { id: "song-thechain", title: "The Chain", artistId: "artist-fleetwoodmac", albumId: "album-rumours", trackNumber: 7, durationMs: 268000, genre: "Rock", playCount: 780000000 },
  // Songs in the Key of Life
  { id: "song-sirduke", title: "Sir Duke", artistId: "artist-steviewonder", albumId: "album-songsinkey", trackNumber: 4, durationMs: 244000, genre: "R&B", playCount: 420000000 },
  { id: "song-iwish", title: "I Wish", artistId: "artist-steviewonder", albumId: "album-songsinkey", trackNumber: 1, durationMs: 258000, genre: "R&B", playCount: 380000000 },
  { id: "song-isntlove", title: "Isn't She Lovely", artistId: "artist-steviewonder", albumId: "album-songsinkey", trackNumber: 5, durationMs: 382000, genre: "R&B", playCount: 620000000 },
  // Blonde
  { id: "song-nights", title: "Nights", artistId: "artist-frankocean", albumId: "album-blonde", trackNumber: 9, durationMs: 306000, genre: "R&B", playCount: 980000000 },
  { id: "song-ivy", title: "Ivy", artistId: "artist-frankocean", albumId: "album-blonde", trackNumber: 3, durationMs: 248000, genre: "R&B", playCount: 420000000 },
  { id: "song-selfc", title: "Self Control", artistId: "artist-frankocean", albumId: "album-blonde", trackNumber: 7, durationMs: 249000, genre: "R&B", playCount: 580000000 },
  // Ziggy Stardust
  { id: "song-starman", title: "Starman", artistId: "artist-davidbowie", albumId: "album-ziggystardust", trackNumber: 7, durationMs: 256000, genre: "Glam Rock", playCount: 620000000 },
  { id: "song-ziggystardust", title: "Ziggy Stardust", artistId: "artist-davidbowie", albumId: "album-ziggystardust", trackNumber: 9, durationMs: 193000, genre: "Glam Rock", playCount: 380000000 },
  // The Joshua Tree
  { id: "song-withorwithoutu", title: "With or Without You", artistId: "artist-u2", albumId: "album-joshuatree", trackNumber: 3, durationMs: 296000, genre: "Rock", playCount: 1100000000 },
  { id: "song-wherethestreets", title: "Where the Streets Have No Name", artistId: "artist-u2", albumId: "album-joshuatree", trackNumber: 1, durationMs: 336000, genre: "Rock", playCount: 520000000 },
  // A Night at the Opera
  { id: "song-bohemian", title: "Bohemian Rhapsody", artistId: "artist-queen", albumId: "album-nightatopera", trackNumber: 11, durationMs: 354000, genre: "Rock", playCount: 2200000000 },
  { id: "song-youremybestfriend", title: "You're My Best Friend", artistId: "artist-queen", albumId: "album-nightatopera", trackNumber: 4, durationMs: 172000, genre: "Rock", playCount: 580000000 },
  // Highway 61 Revisited
  { id: "song-likearollingstone", title: "Like a Rolling Stone", artistId: "artist-bobdylan", albumId: "album-highway61", trackNumber: 1, durationMs: 369000, genre: "Folk Rock", playCount: 420000000 },
];
