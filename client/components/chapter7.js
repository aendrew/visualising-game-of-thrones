import * as d3 from 'd3';
import * as legend from 'd3-svg-legend';
import forceInABox from 'forceInABox';
import * as colors from 'g-chartcolour';
import { adjacencyMatrixLayout } from 'd3-ajacency-matrix-layout';
import {
  // colorScale as color,
  tooltip,
  connectionMatrix,
  uniques,
  fixateColors,
  GoTChart,
} from './common';

const color = d3.scaleOrdinal().range(colors.categorical_line);

// import {
//   fixateColors,
//   addRoot,
//   colorScale as color,
//   tooltip,
//   heightOrValueComparator,
//   valueComparator,
//   descendantsDarker,
//   GoTChart,
// } from './common';

GoTChart.pie = function Pie(_data) {
  const data = _data.filter(d => d.screentime > 60);
  const pie = d3.pie().value(d => +d.screentime);
  const arc = d3.arc()
    .outerRadius(this.width / 4)
    .innerRadius(this.width / 4.5);

  const chart = this.container.append('g')
    .classed('pie', true)
    .attr('transform', `translate(${this.width / 2}, ${this.height / 2})`);

  const slices = chart.append('g')
    .attr('class', 'pie')
    .selectAll('.arc')
    .data(pie(data).sort((a, b) => b.data.screentime - a.data.screentime))
    .enter()
    .append('path')
    .attr('d', arc)
    .classed('arc', true)
    .attr('fill', d => color(d.data.itemLabel));

  slices.call(tooltip(d => d.data.itemLabel, this.container));

  this.container
    .append('g')
    .attr('id', 'legend')
    .attr('transform', `translate(${this.width - 150}, ${(this.height / 2) - 250})`)
    .call(legend.legendColor().scale(color));
};

// GoTChart.histogram = function histogram(_data) {
//   const data = _data.data.map(d =>
//     Object.assign(d, { death: (d.death.season * 100) + d.death.episode }))
//   .sort((a, b) => a.death - b.death);
//
//   const episodesPerSeason = 10;
//   const totalSeasons = 6;
//   const allEpisodes = d3.range(1, totalSeasons + 1).reduce((episodes, s) =>
//     episodes.concat(d3.range(1, episodesPerSeason + 1).map(e => (s * 100) + e)), []);
//
//   const x = d3.scaleBand()
//     .range([0, this.width])
//     .domain(allEpisodes)
//     .paddingOuter(0)
//     .paddingInner(0.25);
//
//   const histogram = d3.histogram()
//     .value(d => d.death)
//     .thresholds(x.domain());
//
//   const bins = histogram(data);
//   const y = d3.scaleLinear()
//     .domain([0, d3.max(bins, d => d.length)])
//     .range([this.height - 10, 0]);
//
//   const bar = this.container.selectAll('.bar')
//     .data(bins)
//     .enter()
//       .append('rect')
//       .attr('x', d => x(d.x0))
//       .attr('y', d => y(d.length))
//       .attr('fill', 'tomato')
//       .attr('width', () => x.bandwidth())
//       .attr('height', d => (this.height - 10) - y(d.length));
//
//   const xAxis = this.container.append('g')
//     .attr('class', 'axis x')
//     .attr('transform', `translate(0, ${this.height - 10})`)
//     .call(d3.axisBottom(x).tickFormat(d => `S${(d - (d % 100)) / 100}E${d % 100}`));
//
//   xAxis.selectAll('text')
//     .each(function (d, i) {
//       const yVal = d3.select(this).attr('y');
//       d3.select(this).attr('y', i % 2 ? yVal : (yVal * 2) + 2);
//     });
//
//   xAxis.selectAll('line')
//     .each(function (d, i) {
//       const y2 = d3.select(this).attr('y2');
//       d3.select(this).attr('y2', i % 2 ? y2 : y2 * 2);
//     });
//
//   bar.call(tooltip(d => `${d.x0}: ${d.length} deaths`, this.container));
// };

GoTChart.stack = function Stack({ data }, { isStream }) {
  const episodesPerSeason = 10;
  const totalSeasons = 6;
  const seasons = d3.nest()
    .key(d => d.death.episode)
    .key(d => d.death.season)
    .entries(data.filter(d => !d.death.isFlashback))
    .map(v => d3.range(1, totalSeasons + 1).reduce((item, episodeNumber) => {
      const deaths = v.values.filter(d => +d.key === episodeNumber).shift() || 0;
      item[`season-${episodeNumber}`] = deaths ? deaths.values.length : 0;
      return item;
    }, { episode: v.key }))
    .sort((a, b) => +a.episode - +b.episode);

  const stack = d3.stack()
    .keys(d3.range(1, totalSeasons + 1).map(key => `season-${key}`));

  if (isStream) stack.offset(d3.stackOffsetWiggle);

  const x = d3.scaleLinear()
    .domain([1, episodesPerSeason])
    .range([this.margin.left, this.width - 20]);

  const y = d3.scaleLinear()
    .domain([
      d3.min(stack(seasons), d => d3.min(d, e => e[0])),
      d3.max(stack(seasons), d => d3.max(d, e => e[1])),
    ])
    .range([this.height - (this.margin.bottom + this.margin.top + 30), 0]);

  const area = d3.area()
      .x(d => x(d.data.episode))
      .y0(d => y(d[0]))
      .y1(d => y(d[1]))
      .curve(d3.curveBasis);

  const stream = this.container.append('g')
    .attr('class', 'streams')
    .selectAll('path')
      .data(stack(seasons))
      .enter()
      .append('path')
        .attr('d', area)
        .style('fill', (d, i) => color(i));

  this.container.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0,${this.height - (this.margin.bottom + this.margin.top + 30)})`)
    .call(d3.axisBottom(x));

  const legendOrdinal = legend.legendColor()
  .orient('horizontal')
  .title('Season')
  .labels(d => d.i + 1)
  .scale(color);

  const legendTransform = isStream ? `translate(50,${this.height - (this.margin.bottom + this.margin.top + 130)})` :
    'translate(50,0)';

  this.container.append('g')
    .attr('class', 'legend')
    .attr('transform', legendTransform)
    .call(legendOrdinal);

  stream.call(tooltip(d => `Season ${d.index + 1}`, this.container));
};

GoTChart.chord = function Chord(_data) {
  const minimumWeight = 20;
  const majorLinks = _data.filter(d => +d.Weight > minimumWeight);
  const majorSources = uniques(majorLinks, d => d.Source);
  const data = majorLinks.filter(d => majorSources.indexOf(d.Target) > -1);

  const matrix = connectionMatrix(data, 'Source', 'Target', 'Weight');
  const outerRadius = (Math.min(this.width, this.height) * 0.5) - 40;
  const innerRadius = outerRadius - 30;
  const chord = d3.chord()
    .padAngle(0.05)
    .sortSubgroups(d3.descending);

  const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius);

  const ribbon = d3.ribbon()
      .radius(innerRadius);

  const chart = this.container
    .append('g')
    .attr('class', 'chord')
    .attr('transform', `translate(${this.width / 2}, ${this.height / 2})`)
    .datum(chord(matrix));

  const group = chart.append('g').attr('class', 'groups')
    .selectAll('g')
    .data(chords => chords.groups)
      .enter()
      .append('g');

  group.append('path')
    .style('fill', d => color(d.index))
    .style('stroke', d => d3.color(color(d.index)).darker())
    .attr('d', arc);

  const ribbons = chart.append('g').attr('class', 'ribbons')
    .selectAll('path')
    .data(chords => chords)
    .enter()
      .append('path')
      .attr('d', ribbon)
      .style('fill', d => color(d.target.index))
      .style('stroke', d => d3.color(color(d.index)).darker());

  ribbons.call(tooltip(d => majorSources[d.target.index], this.container));
  group.call(tooltip(d => majorSources[d.index], this.container));
};

GoTChart.adjacency = function Adjacency(_data) {
  const nodes = uniques(
    _data.map(d => d.Target).concat(_data.map(d => d.Source)),
    d => d)
    .map(d => ({ id: d, total: _data.filter(e => e.Source === d).length }))
    .filter(d => d.total > 0);

  fixateColors(nodes, 'id');

  const links = _data.map(d => ({ source: d.Source, target: d.Target, value: +d.Weight }));
  const edgeWeightScale = d3.scaleLinear().domain(d3.extent(links, d => d.value)).range([0, 1])
  const adjacencyMatrix = adjacencyMatrixLayout()
    .size([this.width, this.height])
    .nodes(nodes)
    .links(links)
    .directed(false)
    .edgeWeight(d => edgeWeightScale(d.value))
    .nodeID(d => d.id);

  const matrixData = adjacencyMatrix();

  console.log(matrixData)

  const someColors = d3.scaleOrdinal()
  .range(d3.schemeCategory20b);

  console.dir(matrixData.filter(d => d.weight));

  this.container
    .selectAll('rect')
    .data(matrixData)
    .enter()
    .append('rect')
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .style('stroke', 'black')
      .style('stroke-width', '1px')
      .style('stroke-opacity', 0.1)
      .style('fill', d => someColors(d.source.group))
      .style('fill-opacity', d => d.weight);

  this.container
    .call(adjacencyMatrix.xAxis);

  this.container
    .call(adjacencyMatrix.yAxis);
};

GoTChart.force = async function Force(_data) {
  const nodes = d3.csvParse(await (await fetch('data/asoiaf-all-nodes.csv')).text());
  fixateColors(nodes, 'modularity_class');

  const links = _data.map(d => ({ source: d.Source, target: d.Target, value: +d.weight }));
  const link = this.container.append('g').attr('class', 'links')
    .selectAll('line')
    .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => color(d.source))
      .attr('stroke-width', d => Math.sqrt(d.value));

  const radius = d3.scaleLinear().domain(d3.extent(nodes, d => +d.eigencentrality)).range([4, 20]);

  const node = this.container.append('g').attr('class', 'nodes')
    .selectAll('circle')
    .data(nodes)
      .enter()
      .append('circle')
      .attr('r', d => radius(d.eigencentrality))
      .attr('fill', d => color(d.id))
      .call(d3.drag()
        .on('start', dragstart)
        .on('drag', dragging)
        .on('end', dragend));

  node.call(tooltip(d => d.id, this.container));

  // const groupingForce = forceInABox()
  //   .strength(0.1) // Strength to foci
  //   .template('force') // Either treemap or force
  //   .groupBy(d => d.modularity_class) // Node attribute to group
  //   .links(links) // The graph links. Must be called after setting the grouping attribute
  //   .enableGrouping(true)
  //   .nodeSize(5) // How big are the nodes to compute the force template
  //   .forceCharge(-200) // Separation between nodes on the force template
  //   .size([this.width, this.height]); // Size of the chart

  const sim = d3.forceSimulation()
    .force('link', d3.forceLink()
      .id(d => d.id)
      .distance(200)
      // .strength(groupingForce.getLinkStrength)
    )
    .force('charge', d3.forceManyBody())
    // .force('group', groupingForce)
    .force('center', d3.forceCenter(this.width / 2, this.height / 2));

  sim.nodes(nodes).on('tick', ticked);
  sim.force('link').links(links);

  function ticked() {
    link.attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

    node.attr('cx', d => d.x)
        .attr('cy', d => d.y);
  }

  function dragstart(d) {
    if (!d3.event.active) sim.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragging(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragend(d) {
    if (!d3.event.active) sim.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
};

export default GoTChart;
