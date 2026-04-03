export type FieldWidget = "auto" | "input" | "textarea" | "wysiwyg";

export type FormElementField = {
  type: "field";
  fieldSlug: string;
  width: "full" | "half";
  widget?: FieldWidget;
};

export type FormElementNote = {
  type: "note";
  text: string;
};

export type FormElementButton = {
  type: "button";
  label: string;
  url: string;
};

export type FormElementDivider = {
  type: "divider";
};

export type FormElementTabGroup = {
  type: "tab-group";
  tabs: FormTab[];
};

export type FormElementColumnGroup = {
  type: "column-group";
  id: string;
  columns: 2 | 3;
  slots: FormElementField[][];
};

export type FormElement =
  | FormElementField
  | FormElementNote
  | FormElementButton
  | FormElementDivider
  | FormElementTabGroup
  | FormElementColumnGroup;

export type FormTab = {
  id: string;
  label: string;
  elements: FormElement[];
};

export type FormLayout = {
  tabs: FormTab[];
};
