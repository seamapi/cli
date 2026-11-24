#!/usr/bin/env bash

set -e
set -u

find_replace () {
  git grep --cached -Il '' | xargs sed -i.sedbak -e "$1"
  find . -name "*.sedbak" -exec rm {} \;
}

sed_insert () {
  sed -i.sedbak -e "$2\\""$3" $1
  rm $1.sedbak
}

sed_delete () {
  sed -i.sedbak -e "$2" $1
  rm $1.sedbak
}

check_env () {
  test -d .git || (echo 'This is not a Git repository. Exiting.' && exit 1)
  for cmd in ${1}; do
    command -v ${cmd} >/dev/null 2>&1 || \
      (echo "Could not find '$cmd' which is required to continue." && exit 2)
  done
  echo
  echo 'Ready to bootstrap your new project!'
  echo
}

stage_env () {
  echo
  echo 'Removing origin and tags.'
  git tag | xargs git tag -d
  git branch --unset-upstream
  git remote rm origin
  echo
  git rm -f makenew.sh
  git rm -f .github/workflows/makenew.yml
  echo
  echo 'Staging changes.'
  git add --all
  echo
  echo 'Done!'
  echo
}

makenew () {
  if [[ -z "${CI:-}" ]]; then
    echo 'Answer all prompts.'
    echo 'There are no defaults.'
    echo 'Example values are shown in parentheses.'
    read -p '> Your GitHub username (my-user): ' mk_codeowner
    read -p '> GitHub repository name (new-repo): ' mk_repo
    read -p '> Package name (@seamapi/new-package): ' mk_slug
    read -p '> Package title (New Package): ' mk_title
    read -p '> Short package description (Foos and bars.): ' mk_description
  fi

  sed_delete README.md '9,75d'
  sed_insert README.md '9i' 'TODO'

  find_replace "s/^  \"version\": \".*\"/  \"version\": \"0.0.0\"/g"
  find_replace "s/TypeScript Module Package Skeleton/${mk_title}/g"
  find_replace "s/Package skeleton for a TypeScript module\./${mk_description}/g"
  find_replace "s/@seambot/@${mk_codeowner}/g"
  find_replace "s|@seamapi/makenew-tsmodule|${mk_slug}|g"
  find_replace "s|makenew-tsmodule|${mk_repo}|g"

  echo
  echo 'Replacing boilerplate.'
}

check_env 'git read sed xargs'
makenew
stage_env
exit
