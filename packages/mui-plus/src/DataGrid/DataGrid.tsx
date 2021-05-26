/*
TODO
- ltr
- row hover
- flex
*/

import * as React from 'react';
import { createSvgIcon, experimentalStyled as styled } from '@material-ui/core';
import useResizeObserver from './useResizeObserver';
// import useEventListener from './useEventListener';
import clsx from 'clsx';
import { useControlled } from './useControlled';
import { clamp } from './math';
import { getTableVirtualSlice } from './virtualization';
import Scroller from './Scroller';

const CLASS_RESIZING = 'NextraMuiThemeResizing';
const CLASS_REVERSE = 'NextraMuiThemeReverse';
const CLASS_TABLE_CELL = 'NextraMuiThemeTableCell';

const Root = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  height: '100%',
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  [`&.${CLASS_RESIZING}`]: {
    userSelect: 'none',
  },
}));

const CenterHeader = styled('div')({
  flex: 1,
  overflow: 'hidden',
});

const PinnedStartHeader = styled('div')({
  display: 'flex',
});

const PinnedEndHeader = styled('div')({
  display: 'flex',
});

const TableHeadRenderPane = styled('div')(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
  position: 'relative',
  height: '100%',
  display: 'flex',
}));

const TableHead = styled('div')({
  display: 'flex',
  flexDirection: 'row',
  width: '100%',
  overflow: 'hidden',
});

const TableBody = styled('div')({
  flex: 1,
  overflow: 'auto',
  position: 'relative',
});

const TableColumns = styled('div')({
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'row',
});

const PinnedStartColumns = styled('div')(({ theme }) => ({
  borderRight: `1px solid ${theme.palette.divider}`,
}));

const PinnedEndColumns = styled('div')(({ theme }) => ({
  borderLeft: `1px solid ${theme.palette.divider}`,
}));

const CenterColumns = styled('div')({
  flex: 1,
  overflow: 'hidden',
});

const TableRowRoot = styled('div')(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  width: '100%',
  position: 'relative',
  display: 'flex',
  overflow: 'visible',
  [`&.${CLASS_REVERSE}`]: {
    flexDirection: 'row-reverse',
  },
}));

const VerticalFillRoot = styled('div')(({ theme }) => ({
  width: '100%',
}));

const TableCellRoot = styled('div')({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  flexShrink: 0,
  flexgrow: 0,
});

const CellContent = styled('div')({
  padding: '0 16px',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
});

const Resizer = styled('div')(({ theme }) => ({
  color: theme.palette.divider,
  display: 'inline-flex',
  alignItems: 'center',
  position: 'absolute',
  top: 0,
  bottom: 0,
  right: 0,
  cursor: 'col-resize',
  zIndex: 1,
  transform: 'translateX(50%)',
  '&:hover': {
    color: theme.palette.action.active,
  },
  [`.${CLASS_REVERSE} &`]: {
    right: 'unset',
    left: 0,
    transform: 'translateX(-50%)',
  },
}));

interface ResizingColumn {
  key: string;
  mouseStartX: number;
  reverse: boolean;
  width: number;
}

export interface ColumnDefinition {
  key: string;
  pin?: 'start' | 'end';
  header?: string;
  visible?: boolean;
  getValue?: (row: any) => any;
  minWidth?: number;
  maxWidth?: number;
  width?: number;
}

export type ColumnDefinitions = ColumnDefinition[];

export interface DataGridProps<RowType = any> {
  /**
   * Column definitions for the grid.
   */
  columns?: ColumnDefinitions;
  onColumnsChange?: (newValue: ColumnDefinitions) => void;
  defaultColumns?: ColumnDefinitions;
  data: RowType[];
  rowHeight?: number;
}

interface ColumnDimensions {
  offset: number;
  width: number;
}

interface ColumnDimensionsMap {
  [key: string]: ColumnDimensions;
}

interface ColumnDefinitionMap {
  [key: string]: ColumnDefinition;
}

interface HasForEach<T> {
  forEach(callbackfn: (value: T, key: number) => void): void;
}

interface UseColumnResizingParams {
  columnDimensions: ColumnDimensionsMap;
  columns: ColumnDefinitions;
  columnByKey: ColumnDefinitionMap;
  getColumnElements: (columnKey: string) => HasForEach<HTMLElement>;
  onColumnsChange: (newValue: ColumnDefinitions) => void;
}

function useColumnResizing({
  columnDimensions,
  columns,
  columnByKey,
  onColumnsChange,
  getColumnElements,
}: UseColumnResizingParams) {
  const [resizingColumn, setResingColumn] =
    React.useState<ResizingColumn | null>(null);

  const handleResizerMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const columnKey = event.currentTarget.dataset.column!;
      const reverse = !!event.currentTarget.dataset.reverse;
      const dimensions = columnDimensions[columnKey];
      if (!dimensions) {
        return;
      }
      setResingColumn({
        key: columnKey,
        mouseStartX: event.clientX,
        reverse,
        width: dimensions.width,
      });
    },
    [columnDimensions]
  );

  React.useEffect(() => {
    if (!resizingColumn) {
      return;
    }

    const calculateResizedColumnWidth = (mouseX: number): number => {
      const widthOffset = mouseX - resizingColumn.mouseStartX;
      const desiredWidth =
        resizingColumn.width + (resizingColumn.reverse ? -1 : 1) * widthOffset;
      return calculateColumnWidth(
        columnByKey[resizingColumn.key],
        desiredWidth
      );
    };

    const handleDocMouseMove = (event: MouseEvent) => {
      const width = calculateResizedColumnWidth(event.clientX);
      const resizingElms = getColumnElements(resizingColumn.key);
      resizingElms.forEach((elm) => {
        elm.style.width = `${width}px`;
      });
    };

    const handleDocMouseUp = (event: MouseEvent) => {
      onColumnsChange(
        columns.map((column) => {
          if (column.key === resizingColumn.key) {
            return {
              ...column,
              width: calculateResizedColumnWidth(event.clientX),
            };
          } else {
            return column;
          }
        })
      );
      setResingColumn(null);
    };

    window.addEventListener('mousemove', handleDocMouseMove);
    window.addEventListener('mouseup', handleDocMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleDocMouseMove);
      window.removeEventListener('mouseup', handleDocMouseUp);
    };
  }, [
    resizingColumn,
    columns,
    columnByKey,
    onColumnsChange,
    getColumnElements,
  ]);

  return {
    handleResizerMouseDown,
    isResizing: !!resizingColumn,
  };
}

const SeparatorIcon = createSvgIcon(<path d="M11 19V5h2v14z" />, 'Separator');

interface BoundingRect {
  top: number;
  height: number;
  left: number;
  width: number;
}

interface GridVirtualSlice {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
}

interface TableRowProps {
  height: number;
  reverse?: boolean;
  children?: React.ReactNode;
}

function TableRow({ height, children, reverse }: TableRowProps) {
  return (
    <TableRowRoot
      className={clsx({ [CLASS_REVERSE]: reverse })}
      style={{ height }}
    >
      {children}
    </TableRowRoot>
  );
}

interface VerticalFillProps {
  height: number;
  children?: React.ReactNode;
}

function VerticalFill({ height, children }: VerticalFillProps) {
  return <VerticalFillRoot style={{ height }}>{children}</VerticalFillRoot>;
}

interface RenderColumnsOptions {
  reverse?: boolean;
  leftMargin?: number;
}

interface TableCellProps {
  width: number;
  columnKey?: string;
  children?: React.ReactNode;
}

function TableCell({ width, columnKey, children }: TableCellProps) {
  return (
    <TableCellRoot
      style={{ width }}
      className={CLASS_TABLE_CELL}
      data-column={columnKey}
    >
      {children}
    </TableCellRoot>
  );
}

function calculateColumnWidth(
  column: ColumnDefinition,
  width?: number
): number {
  return clamp(
    width ?? column.width ?? 100,
    column.minWidth ?? 50,
    column.maxWidth ?? Infinity
  );
}

/**
 * mui-plus DataGrid Component
 */
export default function DataGrid({
  data,
  columns: columnsProp,
  onColumnsChange: onColumnsChangeProp,
  defaultColumns = [],
  rowHeight = 52,
}: DataGridProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);

  const [columns, setColumns] = useControlled(
    'columns',
    columnsProp,
    onColumnsChangeProp,
    defaultColumns
  );

  const [virtualSlice, setVirtualSlice] = React.useState<GridVirtualSlice>();

  const {
    centerColumns,
    pinnedStartColumns,
    pinnedEndColumns,
    columnDimensions,
    columnByKey,
    pinnedStartWidth,
    pinnedEndWidth,
    centerWidth,
  } = React.useMemo(() => {
    const pinnedStartColumns: ColumnDefinitions = [];
    const pinnedEndColumns: ColumnDefinitions = [];
    const centerColumns: ColumnDefinitions = [];
    const columnDimensions: ColumnDimensionsMap = {};
    const columnByKey: ColumnDefinitionMap = {};
    let pinnedStartWidth = 0;
    let pinnedEndWidth = 0;
    let centerWidth = 0;
    for (const column of columns) {
      if (column.visible !== false) {
        const width = calculateColumnWidth(column);
        let offset;
        if (column.pin === 'start') {
          pinnedStartColumns.push(column);
          offset = pinnedStartWidth;
          pinnedStartWidth += width;
        } else if (column.pin === 'end') {
          pinnedEndColumns.push(column);
          offset = pinnedEndWidth;
          pinnedEndWidth += width;
        } else {
          centerColumns.push(column);
          offset = centerWidth;
          centerWidth += width;
        }
        columnDimensions[column.key] = { width, offset };
      }
      columnByKey[column.key] = column;
    }
    return {
      centerColumns,
      pinnedStartColumns,
      pinnedEndColumns,
      columnByKey,
      columnDimensions,
      pinnedStartWidth,
      pinnedEndWidth,
      centerWidth,
    };
  }, [columns]);

  const totalHeight = rowHeight * data.length;
  const totalWidth = pinnedStartWidth + centerWidth + pinnedEndWidth;

  const tableHeadRenderPaneRef = React.useRef<HTMLDivElement>(null);
  const { ref: tableBodyRef, rect: bodyRect } = useResizeObserver();

  const rowCount = data.length;

  const { ref: centerColumnsRef, rect: centerViewport } = useResizeObserver();

  const updateVirtualSlice = React.useCallback(
    (scrollLeft: number, scrollTop: number) => {
      if (!centerViewport) return;
      const getColumnStart = (columnIndex: number) =>
        columnDimensions[centerColumns[columnIndex].key].offset;
      const { startRow, endRow, startColumn, endColumn } = getTableVirtualSlice(
        {
          rowCount,
          rowHeight,
          columnCount: centerColumns.length,
          getColumnStart,
          viewportWidth: centerViewport.width,
          viewportheight: centerViewport.height,
          horizontalScroll: scrollLeft,
          verticalScroll: scrollTop,
          overscan: 3,
        }
      );
      setVirtualSlice((slice) => {
        if (
          slice?.startRow === startRow &&
          slice?.endRow === endRow &&
          slice?.startColumn === startColumn &&
          slice?.endColumn === endColumn
        ) {
          return slice;
        } else {
          return { startRow, endRow, startColumn, endColumn };
        }
      });
    },
    [centerViewport, rowHeight, rowCount, centerColumns, columnDimensions]
  );

  const getColumnElements = React.useCallback((columnKey: string) => {
    return (
      rootRef.current?.querySelectorAll<HTMLDivElement>(
        `.${CLASS_TABLE_CELL}[data-column=${columnKey}]`
      ) || []
    );
  }, []);

  const { handleResizerMouseDown, isResizing } = useColumnResizing({
    columns,
    columnByKey,
    getColumnElements,
    onColumnsChange: setColumns,
    columnDimensions,
  });

  const getCellBoundingrect = React.useCallback(
    (row: number, columnKey: string): BoundingRect => {
      const top = row * rowHeight;
      const { offset, width } = columnDimensions[columnKey]!;
      return {
        top,
        height: rowHeight,
        left: offset,
        width,
      };
    },
    [rowHeight, columnDimensions]
  );

  const {
    centerHeaderElms,
    centerElms,
    pinnedStartHeaderElms,
    pinnedStartElms,
    pinnedEndHeaderElms,
    pinnedEndElms,
  }: {
    centerHeaderElms: React.ReactNode;
    centerElms: React.ReactNode;
    pinnedStartHeaderElms: React.ReactNode;
    pinnedStartElms: React.ReactNode;
    pinnedEndHeaderElms: React.ReactNode;
    pinnedEndElms: React.ReactNode;
  } = React.useMemo(() => {
    if (!virtualSlice) {
      return {
        centerHeaderElms: <React.Fragment></React.Fragment>,
        centerElms: [],
        pinnedStartHeaderElms: <React.Fragment></React.Fragment>,
        pinnedStartElms: [],
        pinnedEndHeaderElms: <React.Fragment></React.Fragment>,
        pinnedEndElms: [],
      };
    }

    const columnsSlice = centerColumns.slice(
      virtualSlice.startColumn,
      virtualSlice.endColumn + 1
    );

    const leftMargin =
      pinnedStartWidth +
      getCellBoundingrect(0, centerColumns[virtualSlice.startColumn].key).left;

    const renderHeader = (
      columns: ColumnDefinitions,
      { leftMargin = 0, reverse = false }: RenderColumnsOptions = {}
    ) => (
      <TableRow height={56} reverse={reverse}>
        {leftMargin > 0 ? <TableCell width={leftMargin} /> : null}
        {columns.map((column) => {
          const headerContent = column?.header ?? column.key;
          const { width } = getCellBoundingrect(0, column.key);
          return (
            <TableCell key={column.key} width={width} columnKey={column.key}>
              <CellContent>{headerContent}</CellContent>
              <Resizer
                onMouseDown={handleResizerMouseDown}
                data-column={column.key}
                data-reverse={reverse ? true : undefined}
              >
                <SeparatorIcon />
              </Resizer>
            </TableCell>
          );
        })}
      </TableRow>
    );

    const pinnedStartHeaderElms = renderHeader(pinnedStartColumns);
    const centerHeaderElms = renderHeader(columnsSlice, { leftMargin });
    const pinnedEndHeaderElms = renderHeader(pinnedEndColumns, {
      reverse: true,
    });

    const topMargin = virtualSlice.startRow * rowHeight;

    const renderBody = (
      columns: ColumnDefinitions,
      { leftMargin = 0, reverse = false }: RenderColumnsOptions = {}
    ) => {
      const elms = [<VerticalFill key={-1} height={topMargin} />];
      for (
        let rowIdx = virtualSlice.startRow;
        rowIdx <= virtualSlice.endRow;
        rowIdx += 1
      ) {
        elms.push(
          <TableRow key={rowIdx} height={rowHeight} reverse={reverse}>
            {leftMargin > 0 ? <TableCell width={leftMargin} /> : null}
            {columns.map((column) => {
              const value = column.getValue
                ? column.getValue(data[rowIdx])
                : data[rowIdx][column.key];
              const { width } = getCellBoundingrect(rowIdx, column.key);
              return (
                <TableCell
                  key={column.key}
                  width={width}
                  columnKey={column.key}
                >
                  <CellContent>{String(value)}</CellContent>
                </TableCell>
              );
            })}
          </TableRow>
        );
      }
      return elms;
    };

    const pinnedStartElms = renderBody(pinnedStartColumns);
    const centerElms = renderBody(columnsSlice, { leftMargin });
    const pinnedEndElms = renderBody(pinnedEndColumns, { reverse: true });

    return {
      centerHeaderElms,
      centerElms,
      pinnedStartHeaderElms,
      pinnedStartElms,
      pinnedEndElms,
      pinnedEndHeaderElms,
    };
  }, [
    virtualSlice,
    getCellBoundingrect,
    centerColumns,
    pinnedStartColumns,
    pinnedStartWidth,
    data,
    handleResizerMouseDown,
    rowHeight,
    pinnedEndColumns,
  ]);

  const tableBodyRenderPaneRef = React.useRef<HTMLDivElement>(null);
  const pinnedStartRenderPaneRef = React.useRef<HTMLDivElement>(null);
  const pinnedEndRenderPaneRef = React.useRef<HTMLDivElement>(null);

  const scrollPosition = React.useRef({ top: 0, left: 0 });
  const updateScroll = React.useCallback(() => {
    const { left: scrollLeft, top: scrollTop } = scrollPosition.current;
    updateVirtualSlice(scrollLeft, scrollTop);
    if (tableBodyRenderPaneRef.current) {
      tableBodyRenderPaneRef.current.style.transform = `translate(${
        -scrollLeft - pinnedStartWidth
      }px, ${-scrollTop}px)`;
    }
    if (pinnedStartRenderPaneRef.current) {
      pinnedStartRenderPaneRef.current.style.transform = `translate(0px, ${-scrollTop}px)`;
    }
    if (pinnedEndRenderPaneRef.current) {
      pinnedEndRenderPaneRef.current.style.transform = `translate(0px, ${-scrollTop}px)`;
    }
    if (tableHeadRenderPaneRef.current) {
      tableHeadRenderPaneRef.current.style.transform = `translate(${
        -scrollLeft - pinnedStartWidth
      }px, 0px)`;
    }
  }, [updateVirtualSlice, pinnedStartWidth]);

  const handleVerticalScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollLeft } = event.currentTarget;
      scrollPosition.current.top = scrollTop;
      scrollPosition.current.left = scrollLeft;
      updateScroll();
    },
    [updateScroll]
  );

  React.useEffect(() => {
    updateScroll();
  }, [updateScroll]);

  // useEventListener(bodyRef, 'wheel', handleWheel, {
  //   passive: false,
  // });

  const hasPinnedStart = pinnedStartColumns.length > 0;
  const hasPinnedEnd = pinnedEndColumns.length > 0;

  return (
    <Root ref={rootRef} className={clsx({ [CLASS_RESIZING]: isResizing })}>
      <TableHead>
        {hasPinnedStart && (
          <PinnedStartHeader>{pinnedStartHeaderElms}</PinnedStartHeader>
        )}
        <CenterHeader style={{ width: bodyRect?.width }}>
          <TableHeadRenderPane
            ref={tableHeadRenderPaneRef}
            style={{ width: totalWidth }}
          >
            {centerHeaderElms}
          </TableHeadRenderPane>
        </CenterHeader>
        {hasPinnedEnd && (
          <PinnedEndHeader>{pinnedEndHeaderElms}</PinnedEndHeader>
        )}
      </TableHead>
      <TableBody ref={tableBodyRef}>
        <Scroller
          onScroll={handleVerticalScroll}
          scrollHeight={totalHeight}
          scrollWidth={totalWidth}
        >
          <TableColumns>
            {hasPinnedStart && (
              <PinnedStartColumns>
                <div ref={pinnedStartRenderPaneRef}>{pinnedStartElms}</div>
              </PinnedStartColumns>
            )}
            <CenterColumns ref={centerColumnsRef}>
              <div
                ref={tableBodyRenderPaneRef}
                style={{ width: totalWidth, height: totalHeight }}
              >
                {centerElms}
              </div>
            </CenterColumns>
            {hasPinnedEnd && (
              <PinnedEndColumns>
                <div ref={pinnedEndRenderPaneRef}>{pinnedEndElms}</div>
              </PinnedEndColumns>
            )}
          </TableColumns>
        </Scroller>
      </TableBody>
    </Root>
  );
}
