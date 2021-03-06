import * as d3 from 'd3';
import * as legend from 'd3-svg-legend';
import {
  fixateColors,
  addRoot,
  colorScale as color,
  tooltip,
  heightOrValueComparator,
  valueComparator,
  descendantsDarker,
  GoTChart,
} from './common';

const getMajorHouses = data => addRoot(data, 'itemLabel', 'fatherLabel', 'Westeros')
    .map((d, i, a) => {
      if (d.fatherLabel === 'Westeros') {
        const childrenLen = a.filter(e => e.fatherLabel === d.itemLabel).length;
        return childrenLen > 0 ? d : undefined;
      }
      return d;
    })
    .filter(i => i);

export const getHouseName = (d) => {
  const ancestors = d.ancestors();
  let house;
  if (ancestors.length > 1) {
    ancestors.pop();
    house = ancestors.pop().id.split(' ').pop();
  } else {
    house = 'Westeros';
  }

  return house;
};

export const houseNames = root => root.ancestors().shift().children.map(getHouseName);

const getHouseColor = d => color(getHouseName(d));

GoTChart.tree = function Tree(_data) {
  const data = getMajorHouses(_data);

  const chart = this.container;

  const stratify = d3.stratify()
    .parentId(d => d.fatherLabel)
    .id(d => d.itemLabel);

  const root = stratify(data);

  const layout = d3.tree()
    .size([
      this.width - 100,
      this.height,
    ]);

  fixateColors(houseNames(root), 'id');

  const line = d3.line().curve(d3.curveBasis);

  const links = chart.selectAll('.link')
    .data(layout(root)
        .descendants()
        .slice(1)
      )
      .enter()
      .append('path')
      .attr('fill', 'none')
      .attr('stroke', 'lightblue')
      .attr('d', d => line([
        [d.x, d.y],
        [d.x, (d.y + d.parent.y) / 2],
        [d.parent.x, (d.y + d.parent.y) / 2],
        // [(d.x + d.parent.x) / 2, d.y],
        // [(d.x + d.parent.y) / 2, d.parent.y],
        [d.parent.x, d.parent.y]],
      ));

  // Nodes
  const nodes = chart.selectAll('.node')
    .data(root.descendants())
    .enter()
      .append('circle')
      .attr('r', 4.5)
      .attr('fill', getHouseColor)
      .attr('class', 'node')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

  const legendGenerator = legend.legendColor()
    .scale(color);

  this.container
    .append('g')
    .attr('id', 'legend')
    .attr('transform', `translate(0, ${this.height / 2})`)
    .call(legendGenerator);

  nodes.call(tooltip(d => d.data.itemLabel, this.container));

  nodes.each(function (d) {
    if (d.id === 'Westeros') { d3.select(this).remove(); }
  });

  links.each(function (d) {
    // console.dir(d);
    if (d.data.fatherLabel === 'Westeros') { d3.select(this).remove(); }
  });
};

GoTChart.cluster = function Cluster(_data) {
  const data = getMajorHouses(_data);

  const stratify = d3.stratify()
    .parentId(d => d.fatherLabel)
    .id(d => d.itemLabel);

  const root = stratify(data);

  fixateColors(houseNames(root), 'id');

  const layout = d3.cluster()
    .size([
      this.height,
      this.width - 150,
    ]);

  const links = layout(root)
    .descendants()
    .slice(1);

  const line = d3.line().curve(d3.curveBasis);

  this.container.selectAll('.link')
    .data(links)
    .enter()
    .append('path')
    .attr('fill', 'none')
    .attr('stroke', 'lightblue')
    .attr('d', d => line([
      [d.y, d.x],
      // [d.y, (d.x + d.parent.x) / 2],
      // [d.parent.y, (d.x + d.parent.x) / 2],
      [(d.y + d.parent.y) / 2, d.x],
      [(d.y + d.parent.y) / 2, d.parent.x],
      [d.parent.y, d.parent.x]],
    ));

  const nodes = this.container.selectAll('.node')
    .data(root.descendants())
    .enter()
    .append('circle')
    .classed('node', true)
      .attr('r', 5)
      .attr('fill', getHouseColor)
      .attr('cx', d => d.y)
      .attr('cy', d => d.x);

  const l = legend
    .legendColor()
    .scale(color);

  this.container
    .append('g')
    .attr('id', 'legend')
    .attr('transform', `translate(${this.width - 100}, 0)`)
    .call(l);

  nodes.call(tooltip(d => d.data.itemLabel, this.container));
};

GoTChart.treemap = function Treemap(_data) {
  const data = getMajorHouses(_data);
  const stratify = d3.stratify()
    .parentId(d => d.fatherLabel)
    .id(d => d.itemLabel);

  const root = stratify(data)
    .sum(d => d.screentime)
    .sort(heightOrValueComparator);

  const cellPadding = 10;
  const houseColors = color.copy().domain(houseNames(root));

  const layout = d3.treemap()
    .size([
      this.width - 100,
      this.height,
    ])
    .padding(cellPadding);

  layout(root);

  const nodes = this.container.selectAll('.node')
    .data(root.descendants().slice(1))
    .enter()
    .append('g')
      .attr('class', 'node');

  nodes.append('rect')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('width', d => d.x1 - d.x0)
    .attr('height', d => d.y1 - d.y0)
    .attr('fill', d => descendantsDarker(d, color, true));

  this.container
    .append('g')
    .attr('id', 'legend')
    .attr('transform', `translate(${this.width - 100}, ${cellPadding})`)
    .call(legend.legendColor().scale(houseColors));

  nodes.call(tooltip(d => d.data.itemLabel, this.container));
};

GoTChart.partition = function Partition(_data) {
  const data = getMajorHouses(_data);

  const stratify = d3.stratify()
    .parentId(d => d.fatherLabel)
    .id(d => d.itemLabel);

  const root = stratify(data)
    .sum(d => d.screentime)
    .sort(heightOrValueComparator);

  const houseColors = color.copy().domain(houseNames(root));

  const layout = d3.partition()
    .size([
      this.width - 175,
      this.height,
    ])
    .padding(2)
    .round(true);

  layout(root);

  const nodes = this.container.selectAll('.node')
    .data(root.descendants().slice(1))
    .enter()
    .append('g')
      .attr('class', 'node');

  nodes.append('rect')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('width', d => d.x1 - d.x0)
    .attr('height', d => d.y1 - d.y0)
    .attr('fill', d => descendantsDarker(d, color));

  this.container
    .append('g')
    .attr('id', 'legend')
    .attr('transform', `translate(${this.width - 100}, 0)`)
    .call(legend.legendColor().scale(houseColors));

  nodes.call(tooltip(d => d.data.itemLabel, this.container));
};

GoTChart.radialPartition = function RadialPartition(_data) {
  const data = getMajorHouses(_data).map((d, i, a) => Object.assign(d, {
    screentime: a.filter(v => v.fatherLabel === d.itemLabel).length ? 0 : d.screentime,
  }));
  const radius = Math.min(this.width, this.height) / 2;

  const stratify = d3.stratify()
    .parentId(d => d.fatherLabel)
    .id(d => d.itemLabel);

  const root = stratify(data)
    .sum(d => d.screentime)
    .sort(null);

  const houseColors = color.copy().domain(root.ancestors().shift().children.map(
    d => d.id.split(' ')[d.id.split(' ').length - 1]),
  );

  const layout = d3.partition()
    .size([
      this.width / 2,
      this.height / 2,
    ])
    .padding(1)
    .round(true);

  const x = d3.scaleLinear()
      .domain([0, radius])
      .range([0, Math.PI * 2]);

  const arc = d3.arc()
    .startAngle(d => x(d.x0))
    .endAngle(d => x(d.x1))
    .innerRadius(d => d.y0)
    .outerRadius(d => d.y1);

  layout(root);

  const nodes = this.container
  .append('g')
  .attr('class', 'nodes')
  .attr('transform', `translate(${this.width / 2}, ${this.height / 2})`)
  .selectAll('.node')
    .data(root.descendants().slice(1))
    .enter()
    .append('g')
      .attr('class', 'node');

  nodes.append('path')
    .attr('d', arc)
    .attr('fill', d => d3.color(color(d.ancestors()[d.ancestors().length - 2].id.split(' ').pop()))
      .darker(d.depth / 5));

  this.container
    .append('g')
    .attr('id', 'legend')
    .attr('transform', `translate(${this.width - 100}, 0)`)
    .call(legend.legendColor().scale(houseColors));

  nodes.call(tooltip(d => d.data.itemLabel, this.container));
};

GoTChart.pack = function Pack(_data) {
  const data = getMajorHouses(_data);

  const stratify = d3.stratify()
    .parentId(d => d.fatherLabel)
    .id(d => d.itemLabel);

  const root = stratify(data)
    .sum(d => d.screentime)
    .sort(valueComparator);

  const houseColors = color.copy().domain(houseNames(root));
  fixateColors(data, 'itemLabel');

  const layout = d3.pack()
    .size([
      this.width - 100,
      this.height,
    ]);

  layout(root);

  const nodes = this.container.selectAll('.node')
    .data(root.descendants().slice(1))
    .enter()
    .append('circle')
      .attr('class', 'node')
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', d => d.r)
      .attr('fill', d => descendantsDarker(d, color, true, 5));

  this.container
    .append('g')
    .attr('id', 'legend')
    .attr('transform', `translate(${this.width - 100}, ${this.height / 2})`)
    .call(legend.legendColor().scale(houseColors));

  nodes.call(tooltip(d => d.data.itemLabel, this.container));
};

export default GoTChart;
