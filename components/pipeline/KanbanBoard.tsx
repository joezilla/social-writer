"use client";

import { useState, useCallback } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import KanbanCard from "./KanbanCard";
import NewIdeaModal from "./NewIdeaModal";

const COLUMNS = [
  { id: "IDEA", label: "Idea", color: "bg-slate-50 border-slate-200" },
  { id: "RESEARCHING", label: "Researching", color: "bg-violet-50/60 border-violet-200" },
  { id: "DRAFTING", label: "Drafting", color: "bg-sky-50/60 border-sky-200" },
  { id: "REVIEW", label: "Review", color: "bg-amber-50/60 border-amber-200" },
  { id: "SCHEDULED", label: "Scheduled", color: "bg-orange-50/60 border-orange-200" },
  { id: "PUBLISHED", label: "Published", color: "bg-emerald-50/60 border-emerald-200" },
] as const;

interface Post {
  id: string;
  title: string;
  body: string;
  status: string;
  topicTags: string;
  voiceScore: number | null;
  updatedAt: string;
}

export default function KanbanBoard({
  initialPosts,
}: {
  initialPosts: Post[];
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [modalOpen, setModalOpen] = useState(false);

  const refreshPosts = useCallback(async () => {
    const res = await fetch("/api/posts");
    const data = await res.json();
    setPosts(data);
  }, []);

  function getColumnPosts(status: string) {
    return posts.filter((p) => p.status === status);
  }

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId;

    setPosts((prev) =>
      prev.map((p) => (p.id === draggableId ? { ...p, status: newStatus } : p))
    );

    await fetch(`/api/posts/${draggableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
  }

  async function handleDelete(id: string) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/posts/${id}`, { method: "DELETE" });
  }

  async function handleDuplicate(id: string) {
    const original = posts.find((p) => p.id === id);
    if (!original) return;

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${original.title} (copy)`,
        topicTags: original.topicTags,
      }),
    });

    if (res.ok) {
      await refreshPosts();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">Content Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {posts.length} {posts.length === 1 ? "post" : "posts"} across all stages
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-foreground text-background rounded-lg hover:opacity-90 text-sm font-medium transition-opacity focus-ring"
        >
          New Idea
        </button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-6 gap-3 min-h-[70vh]">
          {COLUMNS.map((col) => (
            <div key={col.id} className={`rounded-lg border p-2 ${col.color}`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                  {col.label}
                </h2>
                <span className="text-[11px] text-muted-foreground bg-white/80 tabular-nums px-1.5 py-0.5 rounded-full min-w-[1.5rem] text-center">
                  {getColumnPosts(col.id).length}
                </span>
              </div>
              <Droppable droppableId={col.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-[200px] rounded-md p-1 transition-colors duration-150 ${
                      snapshot.isDraggingOver ? "bg-accent/10 ring-1 ring-accent/20" : ""
                    }`}
                  >
                    {getColumnPosts(col.id).map((post, index) => (
                      <Draggable
                        key={post.id}
                        draggableId={post.id}
                        index={index}
                      >
                        {(provided) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <KanbanCard
                              post={post}
                              onDelete={handleDelete}
                              onDuplicate={handleDuplicate}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      <NewIdeaModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={refreshPosts}
      />
    </div>
  );
}
