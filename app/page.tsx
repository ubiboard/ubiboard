import { redirect } from "next/navigation";
import Board from "@/components/Board";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateHomeBoard, listPeople, loadBoardView } from "@/lib/boards";

// La page dépend de l'utilisateur connecté : jamais de rendu statique.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const access = await getOrCreateHomeBoard(user.id);
  const [state, people] = await Promise.all([loadBoardView(access.boardId), listPeople(access.boardId)]);

  return (
    <Board
      boardId={access.boardId}
      boardName={access.name}
      role={access.role}
      initialState={state}
      initialPeople={people}
    />
  );
}
