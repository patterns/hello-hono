
import { drizzle } from "drizzle-orm/d1";
import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";

export const members = sqliteTable("members", {
	id: integer("id").primaryKey({
		autoIncrement: true,
	}),
	name: text("name").notNull(),
	email: text("email").notNull(),
	role: text("role").notNull(),
	guid: text("guid").$defaultFn(() => createId()),

	created: integer("created", {
		mode: "timestamp_ms",
	})
		.notNull()
		.$defaultFn(() => new Date()),
	modified: integer("modified", {
		mode: "timestamp_ms",
	})
		.notNull()
		.$defaultFn(() => new Date()),
	deleted: integer("deleted", {
		mode: "timestamp_ms",
	}),
});
export const membersRelations = relations(members, ({ many }) => ({
	courses: (many),
}));

export const courses = sqliteTable("courses", {
	id: integer("id").primaryKey({
		autoIncrement: true,
	}),
	title: text("title").notNull(),
	description: text("description").notNull(),
	category: text("category").notNull(),
	published: text("published").notNull(),
	url: text("url"),
	instructorId: text("instructor_id"),
	guid: text("guid").$defaultFn(() => createId()),

	created: integer("created", {
		mode: "timestamp_ms",
	})
		.notNull()
		.$defaultFn(() => new Date()),
	modified: integer("modified", {
		mode: "timestamp_ms",
	})
		.notNull()
		.$defaultFn(() => new Date()),
});
export const coursesRelations = relations(courses, ({ one, many }) => ({
	instructor: one(members, {
		fields: [courses.instructorId],
		references: [members.guid],
	}),
	lessons: many(lessons)
}));

export const lessons = sqliteTable("lessons", {
	id: integer("id").primaryKey({
		autoIncrement: true,
	}),
	title: text("title").notNull(),
	content: text("content").notNull(),
	url: text("url"),
	courseId: text("course_id"),
	guid: text("guid").$defaultFn(() => createId()),

	created: integer("created", {
		mode: "timestamp_ms",
	})
		.notNull()
		.$defaultFn(() => new Date()),
	modified: integer("modified", {
		mode: "timestamp_ms",
	})
		.notNull()
		.$defaultFn(() => new Date()),
});
export const lessonsRelations = relations(lessons, ({ one }) => ({
	course: one(courses, {
		fields: [lessons.courseId],
		references: [courses.guid],
	}),
}));



