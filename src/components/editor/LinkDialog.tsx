import { useEffect, useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

type LinkDialogProps = {
  open: boolean;
  initialUrl?: string;
  onClose: () => void;
  onSubmit: (url: string) => void;
};

export function LinkDialog({ open, initialUrl, onClose, onSubmit }: LinkDialogProps) {
  const [url, setUrl] = useState(initialUrl ?? "");

  useEffect(() => {
    if (open) {
      setUrl(initialUrl ?? "");
    }
  }, [open, initialUrl]);

  const handleSubmit = () => {
    onSubmit(url.trim());
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add Link</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="URL"
          margin="dense"
          placeholder="https://example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          type="url"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained">
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
}
