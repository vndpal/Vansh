import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { updatePeople } from "@/lib/store";
import { parsePersonInput, upsertPerson } from "@/lib/tree";

export function POST(request: NextRequest) {
  return handle(request, async () => {
    const input = parsePersonInput(await request.json().catch(() => null));
    const id = crypto.randomUUID();
    const people = await updatePeople((list) => upsertPerson(list, id, input, true));
    return NextResponse.json({ people, id });
  });
}
