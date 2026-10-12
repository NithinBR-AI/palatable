import type { MessageRecord, GroupRecord } from "@/lib/db/schema";
import type { RawMessage } from "@/lib/extract/anchors";

export const SEED_GROUP: GroupRecord = {
  groupId: "group-demo-001",
  name: "The Usual Suspects",
  participants: ["p-alex", "p-zara", "p-marcus", "p-nina"],
  createdAt: "2026-09-01T10:00:00Z",
};

export const SEED_PARTICIPANTS = [
  { id: "p-alex",   name: "Alex",   avatar: "A", color: "#6366f1" },
  { id: "p-zara",   name: "Zara",   avatar: "Z", color: "#f43f5e" },
  { id: "p-marcus", name: "Marcus", avatar: "M", color: "#10b981" },
  { id: "p-nina",   name: "Nina",   avatar: "N", color: "#f59e0b" },
];

function msg(
  id: string,
  participantId: string,
  participantName: string,
  text: string,
  timestamp: string,
): MessageRecord {
  return {
    groupId: "group-demo-001",
    sortKey: `${timestamp}#${id}`,
    participantId,
    participantName,
    text,
    timestamp,
    processed: false,
  };
}

export const SEED_MESSAGES: MessageRecord[] = [
  // Week 1
  msg("m001", "p-alex",   "Alex",   "ok who watched Severance S2 finale?? I'm still processing", "2026-09-02T09:15:00Z"),
  msg("m002", "p-zara",   "Zara",   "finished it at 2am, couldn't sleep after lol", "2026-09-02T09:20:00Z"),
  msg("m003", "p-marcus", "Marcus", "still on episode 4 don't spoil anything", "2026-09-02T09:21:00Z"),
  msg("m004", "p-nina",   "Nina",   "same as Marcus, please hold 😭", "2026-09-02T09:22:00Z"),
  msg("m005", "p-alex",   "Alex",   "ok ok lips sealed. going to the farmers market, anyone want anything", "2026-09-02T10:00:00Z"),
  msg("m006", "p-zara",   "Zara",   "get me the sourdough if they have it", "2026-09-02T10:05:00Z"),
  msg("m007", "p-marcus", "Marcus", "nothing for me, working from home today", "2026-09-02T10:07:00Z"),
  msg("m008", "p-nina",   "Nina",   "same actually, got a call in 10", "2026-09-02T10:08:00Z"),

  msg("m009", "p-marcus", "Marcus", "just discovered Khruangbin and I'm genuinely upset it took me this long", "2026-09-03T14:30:00Z"),
  msg("m010", "p-nina",   "Nina",   "WELCOME to the cult, Con Todo El Mundo is life changing", "2026-09-03T14:35:00Z"),
  msg("m011", "p-alex",   "Alex",   "Khruangbin live is unreal btw, saw them at Hollywood Bowl last year", "2026-09-03T14:40:00Z"),
  msg("m012", "p-zara",   "Zara",   "jealous, I missed that. been on a massive Tame Impala kick lately instead", "2026-09-03T14:45:00Z"),
  msg("m013", "p-marcus", "Marcus", "anyone else's spotify wrapped going to be deeply embarrassing this year", "2026-09-03T15:00:00Z"),
  msg("m014", "p-nina",   "Nina",   "mine is already cooked, I listened to the same 6 songs for 3 months straight", "2026-09-03T15:05:00Z"),

  msg("m015", "p-alex",   "Alex",   "heads up parking enforcement is doing rounds on our street today", "2026-09-04T09:00:00Z"),
  msg("m016", "p-zara",   "Zara",   "oh god moving my car now", "2026-09-04T09:03:00Z"),
  msg("m017", "p-marcus", "Marcus", "already got a ticket last week 🙃", "2026-09-04T09:05:00Z"),
  msg("m018", "p-nina",   "Nina",   "this city is a scam", "2026-09-04T09:06:00Z"),

  msg("m019", "p-nina",   "Nina",   "tried that new izakaya on Melrose last night, completely obsessed", "2026-09-05T19:20:00Z"),
  msg("m020", "p-alex",   "Alex",   "the one with the standing bar? heard it's impossible to get in", "2026-09-05T19:25:00Z"),
  msg("m021", "p-nina",   "Nina",   "exactly that one. worth every minute of the wait. sake selection is insane", "2026-09-05T19:30:00Z"),
  msg("m022", "p-marcus", "Marcus", "adding to the list. ramen place next to my office is still undefeated tho", "2026-09-05T19:35:00Z"),
  msg("m023", "p-zara",   "Zara",   "nothing beats a good bowl at midnight tbh", "2026-09-05T19:40:00Z"),
  msg("m024", "p-alex",   "Alex",   "can someone remind me to book the dentist tomorrow I keep forgetting", "2026-09-05T20:00:00Z"),
  msg("m025", "p-nina",   "Nina",   "reminder set 😂", "2026-09-05T20:01:00Z"),

  msg("m026", "p-zara",   "Zara",   "anyone need anything from Trader Joe's, doing a run", "2026-09-06T11:00:00Z"),
  msg("m027", "p-alex",   "Alex",   "the frozen orange chicken please if they have it", "2026-09-06T11:05:00Z"),
  msg("m028", "p-marcus", "Marcus", "those little almond croissants if you see them", "2026-09-06T11:06:00Z"),
  msg("m029", "p-nina",   "Nina",   "I'm good thanks!", "2026-09-06T11:07:00Z"),

  msg("m030", "p-alex",   "Alex",   "rewatched Parasite again last night. still the best film of the decade no argument", "2026-09-07T22:00:00Z"),
  msg("m031", "p-marcus", "Marcus", "hard agree. Bong Joon-ho is in a different league", "2026-09-07T22:05:00Z"),
  msg("m032", "p-zara",   "Zara",   "have you guys seen Past Lives? watched it twice in a week", "2026-09-07T22:10:00Z"),
  msg("m033", "p-nina",   "Nina",   "destroyed me. cried both times", "2026-09-07T22:12:00Z"),
  msg("m034", "p-alex",   "Alex",   "adding to the list. also The Bear S3 dropped btw", "2026-09-07T22:15:00Z"),
  msg("m035", "p-zara",   "Zara",   "do NOT tell me anything I'm only on ep 2", "2026-09-07T22:16:00Z"),
  msg("m036", "p-marcus", "Marcus", "lips sealed 🤐", "2026-09-07T22:17:00Z"),

  // Week 2
  msg("m037", "p-nina",   "Nina",   "power went out on my block for 3 hours last night, absolutely cooked", "2026-09-09T08:30:00Z"),
  msg("m038", "p-alex",   "Alex",   "oh no. did you lose anything in the fridge?", "2026-09-09T08:35:00Z"),
  msg("m039", "p-nina",   "Nina",   "the leftover pasta. RIP", "2026-09-09T08:37:00Z"),
  msg("m040", "p-zara",   "Zara",   "tragedy", "2026-09-09T08:38:00Z"),

  msg("m041", "p-marcus", "Marcus", "went to that rooftop bar in Silver Lake on Friday, the views are unreal at sunset", "2026-09-10T11:00:00Z"),
  msg("m042", "p-nina",   "Nina",   "which one? the one with the mezcal menu?", "2026-09-10T11:05:00Z"),
  msg("m043", "p-marcus", "Marcus", "yes exactly. live DJ too, very lowkey crowd, not too loud", "2026-09-10T11:10:00Z"),
  msg("m044", "p-zara",   "Zara",   "that's my vibe exactly. cocktail bars with good music > clubs every time", "2026-09-10T11:15:00Z"),
  msg("m045", "p-alex",   "Alex",   "we should have gone together!! next time tell us", "2026-09-10T11:18:00Z"),
  msg("m046", "p-marcus", "Marcus", "it was last minute, literally decided at 9pm", "2026-09-10T11:20:00Z"),

  msg("m047", "p-zara",   "Zara",   "anyone else's internet been terrible today or just me", "2026-09-11T14:00:00Z"),
  msg("m048", "p-alex",   "Alex",   "mine's fine but had issues yesterday", "2026-09-11T14:05:00Z"),
  msg("m049", "p-nina",   "Nina",   "call your provider, I had this last month and they admitted to an outage", "2026-09-11T14:08:00Z"),

  msg("m050", "p-alex",   "Alex",   "just picked up new Nike Killshots, honestly ACE Hotel quality vibes in shoe form", "2026-09-12T16:00:00Z"),
  msg("m051", "p-nina",   "Nina",   "ACE Hotel is such a good reference point. that's aspirational architecture", "2026-09-12T16:05:00Z"),
  msg("m052", "p-marcus", "Marcus", "spoken like someone who has definitely spent too much time in their lobby bar", "2026-09-12T16:10:00Z"),
  msg("m053", "p-alex",   "Alex",   "I work from there twice a week and I refuse to apologize", "2026-09-12T16:12:00Z"),
  msg("m054", "p-zara",   "Zara",   "honestly same energy as always working from that one coffee shop on Vermont", "2026-09-12T16:15:00Z"),

  msg("m055", "p-marcus", "Marcus", "does anyone have a good recommendation for a plumber, mine is being impossible", "2026-09-13T10:00:00Z"),
  msg("m056", "p-nina",   "Nina",   "I used someone last year, will find the number", "2026-09-13T10:05:00Z"),
  msg("m057", "p-alex",   "Alex",   "same issue 6 months ago, it's always the worst timing", "2026-09-13T10:10:00Z"),

  msg("m058", "p-zara",   "Zara",   "went to LACMA last weekend for the first time in ages. forgot how good their Japanese art collection is", "2026-09-14T13:00:00Z"),
  msg("m059", "p-nina",   "Nina",   "that section is underrated. also the Broad is doing something interesting this month", "2026-09-14T13:10:00Z"),
  msg("m060", "p-alex",   "Alex",   "we should do a gallery day honestly. it's been forever", "2026-09-14T13:15:00Z"),
  msg("m061", "p-marcus", "Marcus", "I'm in. Saturday mornings before it gets too crowded?", "2026-09-14T13:20:00Z"),
  msg("m062", "p-zara",   "Zara",   "yes. 9am meet outside?", "2026-09-14T13:22:00Z"),
  msg("m063", "p-nina",   "Nina",   "9am on a Saturday is cruel but ok yes", "2026-09-14T13:25:00Z"),
  msg("m064", "p-alex",   "Alex",   "lmao noted. 10am?", "2026-09-14T13:26:00Z"),
  msg("m065", "p-nina",   "Nina",   "10 I can do", "2026-09-14T13:27:00Z"),

  msg("m066", "p-marcus", "Marcus", "anyone catch that thing about the LA road closures this weekend", "2026-09-15T09:00:00Z"),
  msg("m067", "p-alex",   "Alex",   "yes avoid the 10 completely", "2026-09-15T09:05:00Z"),
  msg("m068", "p-zara",   "Zara",   "this city 😤", "2026-09-15T09:07:00Z"),

  msg("m069", "p-nina",   "Nina",   "guys Bicep new album is so good. if you like Four Tet you'll get it", "2026-09-16T20:00:00Z"),
  msg("m070", "p-zara",   "Zara",   "Four Tet at Low End Theory was a peak moment in my life", "2026-09-16T20:05:00Z"),
  msg("m071", "p-alex",   "Alex",   "I need to explore more of that electronic space. Marcus what would you start with?", "2026-09-16T20:10:00Z"),
  msg("m072", "p-marcus", "Marcus", "honestly just go Khruangbin → Khruangbin live album → then Bonobo → Bicep. you're welcome", "2026-09-16T20:15:00Z"),
  msg("m073", "p-nina",   "Nina",   "saving this as a playlist actually", "2026-09-16T20:18:00Z"),

  msg("m074", "p-alex",   "Alex",   "anyone have the wifi password for the café on Hoover? I keep forgetting", "2026-09-17T11:00:00Z"),
  msg("m075", "p-zara",   "Zara",   "it's on the chalkboard behind the counter", "2026-09-17T11:05:00Z"),
  msg("m076", "p-alex",   "Alex",   "of course it is lol thanks", "2026-09-17T11:06:00Z"),

  // Week 3
  msg("m077", "p-marcus", "Marcus", "happy Monday everyone 🙃", "2026-09-19T09:00:00Z"),
  msg("m078", "p-nina",   "Nina",   "do not", "2026-09-19T09:02:00Z"),
  msg("m079", "p-zara",   "Zara",   "it is NOT Monday energy yet", "2026-09-19T09:03:00Z"),
  msg("m080", "p-alex",   "Alex",   "I haven't had coffee yet so this conversation isn't real", "2026-09-19T09:05:00Z"),

  msg("m081", "p-zara",   "Zara",   "ok real talk, when did we last all do a trip together", "2026-09-20T10:00:00Z"),
  msg("m082", "p-alex",   "Alex",   "...Ojai. that was 2 years ago I think?", "2026-09-20T10:05:00Z"),
  msg("m083", "p-nina",   "Nina",   "that can't be right. ok yes it was 2 years ago and that's embarrassing", "2026-09-20T10:08:00Z"),
  msg("m084", "p-marcus", "Marcus", "we need to fix this. October? before it gets weird with the holidays", "2026-09-20T10:10:00Z"),
  msg("m085", "p-zara",   "Zara",   "yes. somewhere with good food, good music, maybe some culture. not a resort", "2026-09-20T10:15:00Z"),
  msg("m086", "p-alex",   "Alex",   "hard agree on the not-a-resort thing. I want to actually experience somewhere", "2026-09-20T10:20:00Z"),
  msg("m087", "p-nina",   "Nina",   "what about international? budget permitting obviously", "2026-09-20T10:22:00Z"),
  msg("m088", "p-marcus", "Marcus", "I'm open. Japan has been on my list forever", "2026-09-20T10:25:00Z"),
  msg("m089", "p-zara",   "Zara",   "same. or somewhere in Europe with a real food and arts scene", "2026-09-20T10:28:00Z"),
  msg("m090", "p-nina",   "Nina",   "ok let's just ask Palatable, it knows us at this point", "2026-09-20T10:30:00Z"),
  msg("m091", "p-alex",   "Alex",   "yes!! where should we go palatable 👀", "2026-09-20T10:31:00Z"),
];

export const PRE_TRIGGER_MESSAGES = SEED_MESSAGES.slice(0, 90);
export const TRIGGER_MESSAGE = SEED_MESSAGES[90];

export const ALL_MESSAGES_FOR_EXTRACTION: RawMessage[] = SEED_MESSAGES.map((m) => ({
  participantId: m.participantId,
  participantName: m.participantName,
  text: m.text,
  timestamp: m.timestamp,
}));
