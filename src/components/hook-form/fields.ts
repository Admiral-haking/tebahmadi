import { RHFAutocomplete } from "./rhf-autocomplete";
import { RHFCheckbox, RHFMultiCheckbox } from "./rhf-checkbox";
import { RHFEditor } from "./rhf-editor";
import { RHFRadioGroup } from "./rhf-radio-group";
import { RHFMultiSelect, RHFSelect } from "./rhf-select";
import { RHFSwitch, RHFMultiSwitch } from "./rhf-switch";
import { RHFTextField } from "./rhf-text-field";
import { RHFUploadAvatar } from "./rhf-upload-avatar";
import { RHFUploadImage } from "./rhf-upload-image";
import { RHFJalaliDate } from "./rhf-jalali-date";

export const Field = {
  Text: RHFTextField,
  JalaliDate: RHFJalaliDate,
  Select: RHFSelect,
  MultiSelect: RHFMultiSelect,
  Checkbox: RHFCheckbox,
  MultiCheckbox: RHFMultiCheckbox,
  Switch: RHFSwitch,
  MultiSwitch: RHFMultiSwitch,
  RadioGroup: RHFRadioGroup,
  Autocomplete: RHFAutocomplete,
  Editor: RHFEditor,
  UploadAvatar: RHFUploadAvatar,
  UploadImage: RHFUploadImage,
};
