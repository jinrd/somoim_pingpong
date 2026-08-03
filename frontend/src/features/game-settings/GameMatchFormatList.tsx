import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import GameMatchFormatRow from "./GameMatchFormatRow";
import type { MatchFormatDraft } from "./types";

import styles from "./GameSettings.module.css";

interface Props {
  formats: MatchFormatDraft[];
  disabled: boolean;
  onFormatChange: (format: MatchFormatDraft) => void;
  onReorder: (formats: MatchFormatDraft[]) => void;
}

export default function GameMatchFormatList({
  formats,
  disabled,
  onFormatChange,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = formats.findIndex((format) => format.key === active.id);
    const newIndex = formats.findIndex((format) => format.key === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    onReorder(arrayMove(formats, oldIndex, newIndex));
  };

  const handleMove = (formatKey: string, direction: -1 | 1) => {
    const currentIndex = formats.findIndex(
      (format) => format.key === formatKey,
    );
    const targetIndex = currentIndex + direction;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= formats.length) {
      return;
    }

    onReorder(arrayMove(formats, currentIndex, targetIndex));
  };

  if (formats.length === 0) {
    return <p className={styles.emptyFormats}>등록된 세부 경기가 없습니다.</p>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={formats.map((format) => format.key)}
        strategy={verticalListSortingStrategy}
      >
        <div className={styles.formatList}>
          {formats.map((format, index) => (
            <GameMatchFormatRow
              key={format.key}
              format={format}
              position={index + 1}
              isLast={index === formats.length - 1}
              disabled={disabled}
              onChange={onFormatChange}
              onMoved={handleMove}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
