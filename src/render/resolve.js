/*
 * This file is part of espanso-js, a JavaScript port of espanso.
 *
 * Copyright (C) 2019-2021 Federico Terzi (original Rust implementation)
 * Licensed under the GNU General Public License v3.0 or later.
 *
 * Port of espanso-render/src/renderer/resolve.rs
 *
 * Dependency-graph resolution: computes a valid evaluation order for the
 * variables used (directly or transitively) by a match body.
 */

import { getBodyVariableNames, getParamsVariableNames, RendererError } from './util.js';

const BODY_NODE = '__match_body';

export function resolveEvaluationOrder(body, localVars, globalVars) {
  const nodeMap = generateNodes(body, localVars, globalVars);
  const bodyNode = nodeMap.get(BODY_NODE);

  const evalOrder = [];
  const resolved = new Set();
  const seen = new Set();
  resolveDependencies(bodyNode, nodeMap, evalOrder, resolved, seen);

  const ordered = [];
  for (const name of evalOrder) {
    const node = nodeMap.get(name);
    if (!node) throw new Error(`could not find dependency node for variable: ${name}`);
    if (node.variable) ordered.push(node.variable);
  }
  return ordered;
}

function generateNodes(body, localVars, globalVars) {
  const localNodes = localVars.map((variable, index) => {
    const dependencies = new Set();
    if (variable.injectVars) {
      getParamsVariableNames(variable.params).forEach((n) => dependencies.add(n));
    }
    variable.dependsOn.forEach((n) => dependencies.add(n));

    // Every local variable depends on the one before it, to guarantee
    // the execution order within local vars.
    if (index > 0) dependencies.add(localVars[index - 1].name);

    return { name: variable.name, variable, dependencies };
  });

  const globalNodes = globalVars.map((variable) => {
    let dependencies = null;
    if (variable.injectVars || variable.dependsOn.length > 0) {
      dependencies = new Set();
      if (variable.injectVars) {
        getParamsVariableNames(variable.params).forEach((n) => dependencies.add(n));
      }
      variable.dependsOn.forEach((n) => dependencies.add(n));
    }
    return { name: variable.name, variable, dependencies };
  });

  // The body depends on all local variables + the variables read inside it
  const bodyDependencies = new Set(localNodes.map((n) => n.name));
  getBodyVariableNames(body).forEach((n) => bodyDependencies.add(n));

  const nodeMap = new Map();
  nodeMap.set(BODY_NODE, { name: BODY_NODE, variable: null, dependencies: bodyDependencies });
  globalNodes.forEach((n) => nodeMap.set(n.name, n));
  localNodes.forEach((n) => nodeMap.set(n.name, n));
  return nodeMap;
}

function resolveDependencies(node, nodeMap, evalOrder, resolved, seen) {
  seen.add(node.name);

  if (node.dependencies) {
    for (const dependency of node.dependencies) {
      if (resolved.has(dependency)) continue;
      if (seen.has(dependency)) {
        throw new RendererError(
          'circularDependency',
          `circular dependency: \`${node.name}\` -> \`${dependency}\``,
        );
      }
      const dependencyNode = nodeMap.get(dependency);
      if (!dependencyNode) {
        let message = `missing variable: \`${dependency}\``;
        if (node.variable?.type === 'form') message += `\n${FORM_SYNTAX_TIP}`;
        throw new RendererError('missingVariable', message);
      }
      resolveDependencies(dependencyNode, nodeMap, evalOrder, resolved, seen);
    }
  }

  evalOrder.push(node.name);
  resolved.add(node.name);
}

export const FORM_SYNTAX_TIP =
  'TIP: since version 2.1.0-alpha, espanso uses [[control]] (square brackets) instead of ' +
  '{{control}} to define form controls.';
