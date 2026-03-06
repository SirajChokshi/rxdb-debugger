const ARTIST_IMAGE_WIDTH = 640;
const ALBUM_COVER_SIZE = 500;

const ARTIST_MEDIA: Record<string, { commonsFileName: string }> = {
  "artist-beatles": { commonsFileName: "Beatles Trenter 1963.jpg" },
  "artist-pinkfloyd": { commonsFileName: "PinkFloyd1973 retouched.jpg" },
  "artist-ledzeppelin": { commonsFileName: "Led zeppelin revista pelo 1971.jpg" },
  "artist-michaeljackson": { commonsFileName: "Michael Jackson 1983 (3x4 cropped) (contrast).jpg" },
  "artist-prince": { commonsFileName: "Prince Brussels 1986 (retouched).jpg" },
  "artist-nirvana": { commonsFileName: "Nirvana around 1992.jpg" },
  "artist-radiohead": { commonsFileName: "RadioheadO2211125 composite.jpg" },
  "artist-kendrick": { commonsFileName: "Pulitzer2018-portraits-kendrick-lamar.jpg" },
  "artist-kanye": { commonsFileName: "Kanye West at the 2009 Tribeca Film Festival (crop 2).jpg" },
  "artist-taylorswift": { commonsFileName: "Taylor Swift at the 2023 MTV Video Music Awards (2) (cropped).png" },
  "artist-beyonce": { commonsFileName: "Beyoncé - Tottenham Hotspur Stadium - 1st June 2023 (10 of 118) (52946364598) (best crop).jpg" },
  "artist-fleetwoodmac": { commonsFileName: "Fleetwood Mac Billboard 1977.jpg" },
  "artist-steviewonder": { commonsFileName: "Stevie Wonder 1994.jpg" },
  "artist-bobdylan": { commonsFileName: "DylanYoungKilkenny140719v2 (50 of 52) (52246124397) (cropped).jpg" },
  "artist-queen": { commonsFileName: "Queen A Night At The Opera (1975 Elektra publicity photo 02).jpg" },
  "artist-frankocean": { commonsFileName: "Frank Ocean 2022 Blonded.jpg" },
  "artist-davidbowie": { commonsFileName: "David-Bowie Chicago 2002-08-08 photoby Adam-Bielawski-cropped.jpg" },
  "artist-u2": { commonsFileName: "U2 on Joshua Tree Tour 2017 Brussels 8-1-17.jpg" },
};

const ALBUM_MEDIA: Record<string, { releaseGroupId: string }> = {
  "album-abbeyroad": { releaseGroupId: "9162580e-5df4-32de-80cc-f45a8d8a9b1d" },
  "album-sgtpepper": { releaseGroupId: "9f7a4c28-8fa2-3113-929c-c47a9f7982c3" },
  "album-revolver": { releaseGroupId: "72d15666-99a7-321e-b1f3-a3f8c09dff9f" },
  "album-darkside": { releaseGroupId: "f5093c06-23e3-404f-aeaa-40f72885ee3a" },
  "album-thewishyouwerehere": { releaseGroupId: "1a272023-10d3-38ee-bab3-317b55fcc21d" },
  "album-ledzeppeliniv": { releaseGroupId: "2e61da88-39e9-3473-81d2-c964cb394952" },
  "album-physicalgraffiti": { releaseGroupId: "116c9490-6af4-3827-8261-2d5b1f508fe7" },
  "album-thriller": { releaseGroupId: "f32fab67-77dd-3937-addc-9062e28e4c37" },
  "album-bad": { releaseGroupId: "a5711a77-42d1-3f4c-830c-e27a96f0800f" },
  "album-purplerain": { releaseGroupId: "b93a7c47-a6d4-33f2-9034-53fdd991f4ba" },
  "album-1999": { releaseGroupId: "561be5b7-a39c-3866-859d-d86f30816ae7" },
  "album-nevermind": { releaseGroupId: "1b022e01-4da6-387b-8658-8678046e4cef" },
  "album-inutero": { releaseGroupId: "2a0981fb-9593-3019-864b-ce934d97a16e" },
  "album-okcomputer": { releaseGroupId: "b1392450-e666-3926-a536-22c65f834433" },
  "album-kida": { releaseGroupId: "e75c0549-ad55-39e3-8025-c72c5d4a3c5d" },
  "album-inrainbows": { releaseGroupId: "6e335887-60ba-38f0-95af-fae7774336bf" },
  "album-gkmc": { releaseGroupId: "499c19c8-0dab-4824-884b-6191d145e95b" },
  "album-tpab": { releaseGroupId: "d9103c72-3807-4378-9ce7-b6f3e8fdd547" },
  "album-damn": { releaseGroupId: "b88655ba-7469-48b8-a296-b9011ab73ef3" },
  "album-collegedropout": { releaseGroupId: "8a01217e-6947-3927-a39b-6691104694f1" },
  "album-mbdtf": { releaseGroupId: "5d6e21e1-deb5-428e-bb42-c2a567f3619b" },
  "album-yeezus": { releaseGroupId: "5d4d0f2d-9be7-4922-bc9a-cbd2880b12c2" },
  "album-1989": { releaseGroupId: "4d9ec1c2-58ec-48a4-aa0a-916718adead0" },
  "album-folklore": { releaseGroupId: "f1d08326-c23b-4b43-be3b-20b33ab10bf6" },
  "album-midnights": { releaseGroupId: "0dcc84fb-c592-46e9-ba92-a52bb44dd553" },
  "album-lemonade": { releaseGroupId: "c1f22e07-7bdf-4a4f-8b50-7747c1091ef6" },
  "album-renaissance": { releaseGroupId: "2c385052-5083-43a2-b1e5-36566d2ae3c0" },
  "album-rumours": { releaseGroupId: "416bb5e5-c7d1-3977-8fd7-7c9daf6c2be6" },
  "album-songsinkey": { releaseGroupId: "ea88b09b-fd34-33cf-a3e5-25a3a2fb4c6f" },
  "album-blonde": { releaseGroupId: "0da340a0-6ad7-4fc2-a272-6f94393a7831" },
  "album-channelorange": { releaseGroupId: "f8f4167d-897c-4b25-a171-638374d1dfa4" },
  "album-ziggystardust": { releaseGroupId: "6c9ae3dd-32ad-472c-96be-69d0a3536261" },
  "album-joshuatree": { releaseGroupId: "6f3e9fa6-be7a-3de8-a2b2-2072ece8a54d" },
  "album-nightatopera": { releaseGroupId: "6b47c9a0-b9e1-3df9-a5e8-50a6ce0dbdbd" },
  "album-highway61": { releaseGroupId: "fb48b1dc-412f-36aa-8820-1023c08c46c6" },
};

function encodeMediaPathSegment(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, "_");
}

export function getArtistImageUrl(artistId: string): string | undefined {
  const media = ARTIST_MEDIA[artistId];
  if (!media) {
    return undefined;
  }

  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeMediaPathSegment(media.commonsFileName)}?width=${ARTIST_IMAGE_WIDTH}`;
}

export function getAlbumCoverUrl(albumId: string): string | undefined {
  const media = ALBUM_MEDIA[albumId];
  if (!media) {
    return undefined;
  }

  return `https://coverartarchive.org/release-group/${media.releaseGroupId}/front-${ALBUM_COVER_SIZE}`;
}

export const MEDIA_ATTRIBUTION_LINKS = {
  artistPhotos: "https://commons.wikimedia.org/wiki/Main_Page",
  albumCovers: "https://coverartarchive.org/",
  musicbrainz: "https://musicbrainz.org/",
} as const;
