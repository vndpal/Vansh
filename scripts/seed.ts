// Loads the sample family into Redis. Usage: npm run seed  (add -- --force to replace an existing tree)
import { samplePeople } from "../lib/sample-family";
import { loadPeople, savePeople } from "../lib/store";

async function main() {
  const existing = await loadPeople();
  if (existing.length > 0 && !process.argv.includes("--force")) {
    console.error(`The tree already has ${existing.length} people. Run "npm run seed -- --force" to replace it.`);
    process.exit(1);
  }
  await savePeople(samplePeople);
  console.log(`Saved ${samplePeople.length} sample people to Redis.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
