import type { User } from "./types.js";

export const USERS: User[] = [
  { id: "user-alice", username: "alice_music", email: "alice@example.com", displayName: "Alice Johnson", subscriptionType: "premium", country: "USA", birthDate: "1995-03-15" },
  { id: "user-bob", username: "bobthelistener", email: "bob@example.com", displayName: "Bob Smith", subscriptionType: "free", country: "UK", birthDate: "1988-07-22" },
  { id: "user-charlie", username: "charlie_beats", email: "charlie@example.com", displayName: "Charlie Brown", subscriptionType: "premium", country: "Canada", birthDate: "1992-11-08" },
  { id: "user-diana", username: "diana_vinyl", email: "diana@example.com", displayName: "Diana Martinez", subscriptionType: "family", country: "Spain", birthDate: "1990-05-30" },
  { id: "user-eric", username: "eric_hiphop", email: "eric@example.com", displayName: "Eric Wilson", subscriptionType: "premium", country: "USA", birthDate: "1997-01-12" },
];
