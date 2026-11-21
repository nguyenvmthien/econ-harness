import assert from "node:assert/strict";
import { bestVenueRank, rankSources, rankSortValue, searchJournalRanks } from "../dist/journalRanks.js";

const abdc = searchJournalRanks("0002-8282", "ABDC");
assert.ok(abdc.some((row) => row.title === "The American Economic Review" && row.rank === "A*" && row.year === 2025));
const abdcEconomics = searchJournalRanks("0002-8282", "ABDC", 20, "3801");
assert.ok(abdcEconomics.some((row) => row.rank === "A*" && row.fieldOfResearch === "3801"));
assert.equal(searchJournalRanks("0002-8282", "ABDC", 20, "3502").length, 0);
assert.equal(bestVenueRank("American Economic Review", {
  source: "ABDC",
  ranks: ["A*"],
  fieldOfResearch: "3801",
})?.rank, "A*");
assert.equal(bestVenueRank("American Economic Review", {
  source: "ABDC",
  ranks: ["A*"],
  fieldOfResearch: "3502",
}), null);

const sjr = bestVenueRank("American Economic Review", {
  source: "SJR",
  ranks: ["Q1", "Q2"],
  subjectCategory: "Economics and Econometrics",
});
assert.equal(sjr?.rank, "Q1");
assert.equal(sjr?.year, 2025);

const categorySpecific = bestVenueRank("Cancer Cell International", {
  source: "SJR",
  ranks: ["Q2"],
  subjectCategory: "Cancer Research",
});
assert.equal(categorySpecific?.rank, "Q2");
assert.equal(categorySpecific?.subjectCategories?.[0]?.name, "Cancer Research");
assert.equal(bestVenueRank("Cancer Cell International", {
  source: "SJR",
  ranks: ["Q1"],
  subjectCategory: "Cancer Research",
}), null);
assert.ok(searchJournalRanks("Journal of Finance", "SJR").some((row) => row.subjectCategories?.some((category) => category.name === "Finance")));
assert.equal(bestVenueRank("American Economic Review", { source: "ABDC", ranks: ["Q1"] }), null);
assert.ok(rankSortValue("A*") < rankSortValue("A"));
assert.ok(rankSortValue("Q1") < rankSortValue("Q2"));
assert.equal(rankSources().SJR.year, 2025);
assert.equal(rankSources().ABDC.year, 2025);

console.log("JOURNAL RANK TEST PASSED");
