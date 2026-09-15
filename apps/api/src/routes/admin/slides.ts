import { eq, desc } from 'drizzle-orm';
import { Router } from 'express';
import { db } from '../../db';
import { slides } from '../../db/schema';
import { requireAdmin } from '../auth';
import { z } from 'zod';

export const adminSlidesRouter = Router();
adminSlidesRouter.use(requireAdmin);

const slideSchema = z.object({
  title: z.string().optional(),
  imageUrl: z.string().min(1, 'Image is required'),
  linkUrl: z.string().optional(),
  sortOrder: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
});

// List all slides
adminSlidesRouter.get('/', async (req, res) => {
  try {
    const list = await db.select().from(slides).orderBy(desc(slides.sortOrder), desc(slides.id));
    res.json(list);
  } catch (err) {
    console.error('List slides error', err);
    res.status(500).json({ error: 'Failed to load slides' });
  }
});

// Create slide
adminSlidesRouter.post('/', async (req, res) => {
  try {
    const data = slideSchema.parse(req.body);
    const [created] = await db.insert(slides).values(data).returning();
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    console.error('Create slide error', err);
    res.status(500).json({ error: 'Failed to create slide' });
  }
});

// Update slide
adminSlidesRouter.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    const data = slideSchema.parse(req.body);
    
    const [updated] = await db
      .update(slides)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(slides.id, id))
      .returning();
      
    if (!updated) return res.status(404).json({ error: 'Slide not found' });
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors[0].message });
    console.error('Update slide error', err);
    res.status(500).json({ error: 'Failed to update slide' });
  }
});

// Delete slide
adminSlidesRouter.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
    
    const [deleted] = await db.delete(slides).where(eq(slides.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: 'Slide not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete slide error', err);
    res.status(500).json({ error: 'Failed to delete slide' });
  }
});
