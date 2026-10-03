// Standardized OMR Bubble Sheet Layout Specification
// ALL coordinates (u, v) are normalized strictly in [0.0, 1.0] relative to the 4 Corner Alignment Markers:
// Top-Left (TL) = (0.0, 0.0)
// Top-Right (TR) = (1.0, 0.0)
// Bottom-Left (BL) = (0.0, 1.0)
// Bottom-Right (BR) = (1.0, 1.0)

export const CORNER_MARKER_RELATIVE_SIZE = 0.055; // 5.5% of marker span

/**
 * Returns the normalized layout geometry for a bubble sheet with given question count and options.
 * Everything is defined relative to the 4 corner fiducial markers.
 */
export function getSheetLayout(numQuestions = 10, options = ['A', 'B', 'C', 'D']) {
  const isMultiColumn = numQuestions > 10;
  const numColumns = isMultiColumn ? (numQuestions > 25 ? 3 : 2) : 1;
  const questionsPerColumn = Math.ceil(numQuestions / numColumns);

  // Header zone: v from 0.02 to 0.16
  // Bubble Grid zone: v from 0.22 to 0.94
  const gridTopV = 0.22;
  const gridBottomV = 0.94;
  const availableHeight = gridBottomV - gridTopV;

  // For small question counts (e.g. 5 or 7 questions), cap the row spacing so rows don't stretch unnaturally
  const maxRowSpacing = numColumns === 1 ? 0.085 : 0.075;
  const calculatedRowSpacing = availableHeight / Math.max(questionsPerColumn, 8);
  const rowSpacing = Math.min(maxRowSpacing, calculatedRowSpacing);

  const questions = {};

  for (let q = 1; q <= numQuestions; q++) {
    const colIndex = Math.floor((q - 1) / questionsPerColumn);
    const rowIndex = (q - 1) % questionsPerColumn;

    // Horizontal column bounds in [0.0, 1.0]
    const colWidth = 0.94 / numColumns;
    const colStartU = 0.03 + colIndex * colWidth;

    // Vertical position of this question row
    const rowV = gridTopV + (rowIndex + 0.6) * rowSpacing;

    // Inside this column:
    let labelU, bubbleAreaStartU, bubbleAreaWidth;
    if (numColumns === 1) {
      // Centered single column for 1-10 questions
      labelU = 0.22;
      bubbleAreaStartU = 0.30;
      bubbleAreaWidth = 0.54;
    } else if (numColumns === 2) {
      labelU = colStartU + 0.06;
      bubbleAreaStartU = colStartU + 0.12;
      bubbleAreaWidth = colWidth * 0.78;
    } else {
      labelU = colStartU + 0.04;
      bubbleAreaStartU = colStartU + 0.08;
      bubbleAreaWidth = colWidth * 0.82;
    }

    const optSpacing = bubbleAreaWidth / options.length;
    const optionCoordinates = {};
    const radius = Math.min(numColumns === 1 ? 0.022 : (numColumns === 2 ? 0.019 : 0.016), rowSpacing * (1440 / 1056) * 0.32);

    options.forEach((opt, optIdx) => {
      const bubbleU = bubbleAreaStartU + (optIdx + 0.5) * optSpacing;
      optionCoordinates[opt] = {
        u: bubbleU,
        v: rowV,
        radius
      };
    });

    // Reference paper patch: guaranteed pure white paper between the question label and bubble A
    const firstBubbleU = bubbleAreaStartU + 0.5 * optSpacing;
    const paperRef = {
      u: (labelU + firstBubbleU) / 2,
      v: rowV
    };

    questions[q] = {
      number: q,
      column: colIndex,
      row: rowIndex,
      v: rowV,
      labelU,
      options: optionCoordinates,
      paperRef
    };
  }

  return {
    numQuestions,
    options,
    numColumns,
    questionsPerColumn,
    rowSpacing,
    header: {
      title: { u: 0.03, v: 0.03 },
      instructions: { u: 0.65, v: 0.02 },
      nameField: { u: 0.03, v: 0.10 },
      idField: { u: 0.44, v: 0.10 },
      dateField: { u: 0.72, v: 0.10 },
      dividerV: 0.15
    },
    questions
  };
}
