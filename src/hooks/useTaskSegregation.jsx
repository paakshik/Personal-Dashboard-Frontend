import {useMemo} from 'react';

export const useTaskSegregation = (tasks = []) => useMemo(() => {
    const groups = tasks.reduce((acc, task) => {
        const group = task.projectId || 'Uncategorized';
        (acc[group] ||= []).push(task);
        return acc;
    }, {});
    return Object.fromEntries(Object.keys(groups).sort().map((key) => [key, groups[key]]));
}, [tasks]);
