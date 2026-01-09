import { useState, useEffect } from 'react';

export const useTaskSegregation = (tasks) => {
    const [segregatedTasks, setSegregatedTasks] = useState({});

    useEffect(() => {
        if (tasks.length === 0) {
            setSegregatedTasks({});
            return;
        }

        const groups = tasks.reduce((acc, task) => {
            const groupKey = task.projectId || 'Uncategorized';
            if (!acc[groupKey]) {
                acc[groupKey] = [];
            }
            acc[groupKey].push(task);
            return acc;
        }, {});
        
        // Sort keys (projects) alphabetically
        const sortedGroups = Object.keys(groups).sort().reduce(
            (obj, key) => {
                obj[key] = groups[key];
                return obj;
            },
            {}
        );

        setSegregatedTasks(sortedGroups);
    }, [tasks]);

    return segregatedTasks;
};