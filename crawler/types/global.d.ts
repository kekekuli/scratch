interface RawTable{
    tHead: string[];
    tBody: string[][]; 
}

interface NamedTimeline {
    name: string;
    timeline: { [key: string]: any };
}

type Selector = string;

interface TreeNode {
    id: string;
    title: string;
    children: TreeNode[];
    buttonIcoId: string;
    hrefId: string;
}