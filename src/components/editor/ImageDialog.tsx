import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";

type ImageDialogProps = {
  open: boolean;
  initialSrc?: string;
  initialAlt?: string;
  onClose: () => void;
  onSubmit: (options: { src: string; alt?: string }) => void;
};

export function ImageDialog({
  open,
  initialSrc,
  initialAlt,
  onClose,
  onSubmit,
}: ImageDialogProps) {
  const [src, setSrc] = useState(initialSrc ?? "");
  const [alt, setAlt] = useState(initialAlt ?? "");

  useEffect(() => {
    if (open) {
      setSrc(initialSrc ?? "");
      setAlt(initialAlt ?? "");
    }
  }, [open, initialSrc, initialAlt]);

  const handleSubmit = () => {
    onSubmit({ src: src.trim(), alt: alt.trim() || undefined });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Insert Image</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="Image URL"
            placeholder="https://example.com/image.jpg"
            value={src}
            onChange={(event) => setSrc(event.target.value)}
            type="url"
          />
          <TextField
            fullWidth
            label="Alt text"
            placeholder="Describe the image"
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!src.trim()} variant="contained">
          Insert
        </Button>
      </DialogActions>
    </Dialog>
  );
}

