import { NextResponse, type NextRequest } from "next/server";
import { handle } from "@/lib/api";
import { updatePeople } from "@/lib/store";
import { deletePerson, parsePersonInput, upsertPerson } from "@/lib/tree";

type Context = { params: Promise<{ id: string }> };

export function PUT(request: NextRequest, { params }: Context) {
  return handle(request, async () => {
    const { id } = await params;
    const input = parsePersonInput(await request.json().catch(() => null));
    const people = await updatePeople((list) => upsertPerson(list, id, input, false));
    return NextResponse.json({ people });
  });
}

export function DELETE(request: NextRequest, { params }: Context) {
  return handle(request, async () => {
    const { id } = await params;
    const people = await updatePeople((list) => deletePerson(list, id));
    return NextResponse.json({ people });
  });
}
