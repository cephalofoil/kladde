# Generate Commit Message

Create a properly formatted commit message following the Conventional Commits specification.

## Steps

1. Examine the staged changes to understand what was modified

2. Read the commit style guidelines to ensure compliance

3. Generate a well-structured commit message based on the changes

4. Format the message with type, scope, description, and body

## Instructions

Analyze the staged changes in the repository and generate a commit message following our style guidelines:

1. First, check the current staged changes using `git diff --staged`

2. Identify the appropriate type (feat, fix, docs, etc.) based on the changes

3. Determine a suitable scope for the changes

4. Write a concise description in imperative present tense (max 50 chars)

5. Add a more detailed explanation in the commit body if needed

6. Include references to issues/PRs in the footer if applicable

7. Format the final message according to the Conventional Commits spec

Generate the formatted commit message and prepare the git commit command with it. The commit message should be structured as:

```gitcommit

<type>(<scope>): <description>



<body>



<footer>

```

Remember to:

- Use imperative present tense ("add" not "added")

- Don't capitalize the first letter of the description

- No period at the end of the description

- Keep the description concise (less than 50 characters)

- Explain "why" in the body, not just "what"

# Commit Style Guidelines

This document outlines the commit message conventions used across the platform repositories.

## Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```gitcommit

<type>(<scope>): <description>



[optional body]



[optional footer(s)]

```

### Types

- **feat**: A new feature

- **fix**: A bug fix

- **docs**: Documentation changes

- **style**: Changes that do not affect the meaning of the code (formatting, etc.)

- **refactor**: Code changes that neither fix a bug nor add a feature

- **perf**: Changes that improve performance

- **test**: Adding or modifying tests

- **chore**: Changes to the build process or auxiliary tools

- **ci**: Changes to CI/CD configuration files and scripts

### Scope

The scope should be the name of the component affected:

- **canvas**: Changes to canvas workspace and core functionality

- **tiles**: Changes to tile components and content renderers

- **ui**: Changes to UI components and design system

- **store**: Changes to Zustand state management

- **editor**: Changes to Lexical editor and rich text features

- **ai**: Changes to AI integration and workflow

- **types**: Changes to TypeScript type definitions

- **api**: Changes to API routes and endpoints

- **docs**: Documentation changes

### Description

- Use the imperative, present tense: "add" not "added" or "adds"

- Don't capitalize the first letter

- No period at the end

- Keep it concise (less than 50 characters)

### Body

- Use the imperative, present tense

- Include the motivation for the change and contrast with previous behavior

- Separate paragraphs with blank lines

### Footer

- Reference GitHub issues and PRs: "Fixes #123", "Closes #456"

- Breaking changes should start with "BREAKING CHANGE:"

## Examples

```gitcommit

feat(tiles): add minimum size enforcement for tile resizing



Added minimum width and height constraints to prevent tiles from becoming
too small to interact with. Each tile type now has appropriate minimum
dimensions defined in tile-utils.ts.



Closes #123

```

```gitcommit

fix(editor): correct markdown import/export synchronization



The editor content was not properly syncing between rich text and markdown
modes due to timing issues with Lexical state updates.

```

```gitcommit

refactor: split filePathName into path and filename



BREAKING CHANGE: The filePathName field has been split into separate path and

filename fields for better clarity and flexibility.

```

## Best Practices

1. **Keep commits atomic**: Each commit should represent a single logical change

2. **Write meaningful messages**: Someone reading the commit log should understand what changed and why

3. **Reference issues**: Always reference related issues and PRs

4. **Use the body for details**: Complex changes should be explained in the commit body

5. **Consider reviewers**: Make it easy for reviewers to understand your changes
