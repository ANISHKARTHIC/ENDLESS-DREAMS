"use client";

import React, { useEffect, useRef } from "react";
import { ItineraryCard, DAY_COLORS } from "./itinerary-card";
import type { ItineraryItem } from "@/types";
import { motion } from "framer-motion";

import { useCurrency } from "@/contexts/currency-context";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ItineraryTimelineProps {
  items: ItineraryItem[];
  dayGroups: Record<string, ItineraryItem[]>;
  onToggleLock?: (itemId: string) => void;
  onReorder?: (items: { item_id: string; day_number: number; order: number }[]) => void;
  onStatusChange?: (itemId: string, status: string) => void;
  onActiveItemChange?: (itemId: string | null, dayNumber: number | null) => void;
}

function SortableItem({
  item,
  index,
  dayColor,
  onToggleLock,
  onStatusChange,
}: {
  item: ItineraryItem;
  index: number;
  dayColor: string;
  onToggleLock?: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <ItineraryCard
        item={item}
        index={index}
        dayColor={dayColor}
        onToggleLock={onToggleLock}
        onStatusChange={onStatusChange}
        isDragging={isDragging}
        dragHandleProps={listeners}
      />
    </div>
  );
}


export function ItineraryTimeline({
  items,
  dayGroups,
  onToggleLock,
  onReorder,
  onStatusChange,
  onActiveItemChange,
}: ItineraryTimelineProps) {
  const { convertFromUsd, symbol } = useCurrency();
  const containerRef = useRef<HTMLDivElement>(null);

  // Track which itinerary card is in viewport and notify parent
  useEffect(() => {
    if (!onActiveItemChange) return;
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        visible.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const target = visible[0].target as HTMLElement;
        const itemId = target.dataset.itemId ?? null;
        const dayNumber = target.dataset.dayNumber ? Number(target.dataset.dayNumber) : null;
        onActiveItemChange(itemId, dayNumber);
      },
      { threshold: [0.3, 0.6], rootMargin: "-10% 0px -35% 0px" }
    );

    const cards = container.querySelectorAll<HTMLElement>("[data-item-id]");
    cards.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [onActiveItemChange, items, dayGroups]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const days = Object.keys(dayGroups)
    .map(Number)
    .sort((a, b) => a - b);

  const handleDragEnd = (dayNumber: number) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onReorder) return;

    const dayItems = dayGroups[dayNumber.toString()] || [];
    const oldIndex = dayItems.findIndex((i) => i.id === active.id);
    const newIndex = dayItems.findIndex((i) => i.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...dayItems];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    onReorder(
      reordered.map((item, idx) => ({
        item_id: item.id,
        day_number: dayNumber,
        order: idx,
      }))
    );
  };

  return (
    <div ref={containerRef} className="space-y-8">
      {days.map((day, dayIdx) => {
        const dayItems = dayGroups[day.toString()] || [];
        const totalCost = dayItems.reduce((s, i) => s + Number(i.estimated_cost_usd), 0);
        const totalDuration = dayItems.reduce((s, i) => s + Number(i.duration_minutes), 0);

        return (
          <motion.div
            key={day}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: dayIdx * 0.1 }}
            className="rounded-2xl border border-border/40 bg-card/20 backdrop-blur-sm p-4 sm:p-5"
          >
            {/* Day header */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-9 w-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0"
                  style={{ backgroundColor: DAY_COLORS[(day - 1) % DAY_COLORS.length] }}
                >
                  {day}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-[15px] leading-tight">Day {day}</h3>
                  <p className="text-[11px] text-muted-foreground/70">
                    {dayItems.length} {dayItems.length === 1 ? "activity" : "activities"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-muted/70 border border-border/40 px-2.5 py-1 text-xs font-semibold text-foreground/70">
                  {symbol}{Math.round(convertFromUsd(totalCost)).toLocaleString()}
                </span>
                <span className="rounded-lg bg-muted/70 border border-border/40 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {Math.round(totalDuration / 60)}h {totalDuration % 60}m
                </span>
              </div>
            </div>

            {/* Cards list */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd(day)}
            >
              <SortableContext
                items={dayItems.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {dayItems.map((item, itemIdx) => {
                    const dc = DAY_COLORS[(day - 1) % DAY_COLORS.length];
                    return (
                      <div key={item.id} data-item-id={item.id} data-day-number={item.day_number}>
                        <SortableItem
                          item={item}
                          index={itemIdx + 1}
                          dayColor={dc}
                          onToggleLock={onToggleLock}
                          onStatusChange={onStatusChange}
                        />
                      </div>
                    );
                  })}
                  {dayItems.length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground/50 rounded-xl border border-dashed border-border/40">
                      No activities planned for this day
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </motion.div>
        );
      })}
    </div>
  );
}
