-- Add page detection columns to frames table
ALTER TABLE public.frames 
ADD COLUMN IF NOT EXISTS corner_coordinates JSONB,
ADD COLUMN IF NOT EXISTS is_detected_page BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS detection_confidence FLOAT;

-- Add index for detected pages
CREATE INDEX IF NOT EXISTS idx_frames_detected_pages ON public.frames(scan_id, is_detected_page) 
WHERE is_detected_page = true;

-- Add comment explaining the corner_coordinates structure
COMMENT ON COLUMN public.frames.corner_coordinates IS 'Array of 4 corner points in order: top-left, top-right, bottom-right, bottom-left. Each point has x and y coordinates. Example: [{"x": 0, "y": 0}, {"x": 100, "y": 0}, {"x": 100, "y": 150}, {"x": 0, "y": 150}]';

COMMENT ON COLUMN public.frames.is_detected_page IS 'True if this frame contains a detected document page';

COMMENT ON COLUMN public.frames.detection_confidence IS 'Confidence score of page detection (0-1)';