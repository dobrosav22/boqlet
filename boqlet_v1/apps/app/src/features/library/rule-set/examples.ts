/**
 * Example formulas and names shown as placeholders. They are code (formula syntax, IFC names),
 * not words, so they stay out of the message catalogue; ExprInput shows them in readable form.
 */
export const EXAMPLE = {
  selectorExpr: 'thickness > 0.2 AND UNDER(element_type, "wall.party")',
  property: "Pset_WallCommon.FireRating",
  classes: "IfcWall, IfcSlab",
  quantityFormula: "net_area - SUM(openings.area WHERE area > p.opening_threshold)",
  whenIf: "thickness >= p.masonry_volume_from",
  deductionWhere: 'kind = "window"',
  partFilter: 'NOT UNDER(material, "air_gap")',
  derivedWhere: 'UNDER(material, "concrete")',
  derivedLine: "qty * 1.05",
  derivedElement: 'SUM(faces.gross_area WHERE side = "a")',
  manualFormula: "building.gross_volume / 100",
  lineText: "Wall, {type_name}, {thickness*1000} mm",
  bandEdges: "3.5, p.high",
} as const;
